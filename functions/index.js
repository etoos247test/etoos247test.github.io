const crypto = require("node:crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

const db = getFirestore();
const auth = getAuth();
const VALID_CAMPUSES = new Set(["suseong1", "suseong2"]);
const STUDENT_CODE_PATTERN = /^[MS](00[1-9]|0[1-9][0-9]|1[0-9]{2})$/;

async function getProfile(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "사용자 권한 문서가 없습니다.");
  return { uid, ...snap.data() };
}

function hasCampusAccess(profile, campus) {
  if (profile.role === "master" && profile.active === true) return true;
  return profile.role === "teacher"
    && profile.active === true
    && Array.isArray(profile.allowedCampuses)
    && profile.allowedCampuses.includes(campus);
}

function normalizeStudentId(value) {
  const studentId = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!STUDENT_CODE_PATTERN.test(studentId)) {
    throw new HttpsError("invalid-argument", "학생코드는 수성1관 M001~M199 또는 수성2관 S001~S199로 입력해야 합니다.");
  }
  return studentId;
}

function normalizeStudentName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 2 || name.length > 40) {
    throw new HttpsError("invalid-argument", "학생 이름은 2~40자로 입력하세요.");
  }
  return name;
}

function campusFromStudentId(studentId) {
  return studentId.startsWith("M") ? "suseong1" : "suseong2";
}

function campusLabel(campus) {
  return campus === "suseong1" ? "수성1관" : "수성2관";
}

function studentAccountEmail(studentId) {
  return `${studentId.toLowerCase()}@etoos247test.local`;
}

function validateDisplayedCampus(requestedCampus, derivedCampus) {
  if (requestedCampus && !VALID_CAMPUSES.has(requestedCampus)) {
    throw new HttpsError("invalid-argument", "소속관이 올바르지 않습니다.");
  }
  if (requestedCampus && requestedCampus !== derivedCampus) {
    throw new HttpsError("invalid-argument", `${campusLabel(requestedCampus)}과 학생코드가 일치하지 않습니다.`);
  }
}

function canCreateStudent(profile, campus) {
  return (profile.role === "master" && profile.active === true)
    || (
      profile.role === "teacher"
      && profile.active === true
      && profile.canApproveStudents === true
      && hasCampusAccess(profile, campus)
    );
}

async function ensureStudentCodeAvailable(studentId, excludedUid = "") {
  const duplicate = await db.collection("users")
    .where("studentId", "==", studentId)
    .limit(5)
    .get();
  const conflict = duplicate.docs.find((docSnap) => docSnap.id !== excludedUid && docSnap.data().role === "student");
  if (conflict) throw new HttpsError("already-exists", `${studentId} 학생코드가 이미 있습니다.`);
}

exports.createStudentAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const studentId = normalizeStudentId(request.data?.studentId);
  const campus = campusFromStudentId(studentId);
  const requestedCampus = typeof request.data?.campus === "string" ? request.data.campus.trim() : "";
  validateDisplayedCampus(requestedCampus, campus);

  const name = normalizeStudentName(request.data?.name);
  const password = typeof request.data?.password === "string" ? request.data.password : "";
  if (password.length < 8 || password.length > 64) {
    throw new HttpsError("invalid-argument", "초기 비밀번호는 8~64자로 입력하세요.");
  }

  const caller = await getProfile(request.auth.uid);
  if (!canCreateStudent(caller, campus)) {
    throw new HttpsError("permission-denied", "이 소속관의 학생 계정을 생성할 권한이 없습니다.");
  }

  const email = studentAccountEmail(studentId);
  await ensureStudentCodeAvailable(studentId);

  try {
    await auth.getUserByEmail(email);
    throw new HttpsError("already-exists", `${studentId} 로그인 계정이 이미 있습니다.`);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error.code !== "auth/user-not-found") throw error;
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email,
      emailVerified: true,
      password,
      displayName: `${studentId} ${name}`,
      disabled: false
    });

    const batch = db.batch();
    batch.set(db.doc(`users/${userRecord.uid}`), {
      role: "student",
      active: true,
      campus,
      studentId,
      name,
      email,
      loginKey: studentId,
      mustChangePassword: true,
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid
    });
    batch.set(db.collection("auditLogs").doc(), {
      action: "student_account_created",
      targetUid: userRecord.uid,
      targetStudentId: studentId,
      campus,
      actorUid: request.auth.uid,
      actorRole: caller.role,
      createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();
  } catch (error) {
    if (userRecord?.uid) {
      try {
        await auth.deleteUser(userRecord.uid);
      } catch (cleanupError) {
        console.error("학생 계정 정리 실패", cleanupError);
      }
    }
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", `${studentId} 로그인 계정이 이미 있습니다.`);
    }
    if (error instanceof HttpsError) throw error;
    console.error(error);
    throw new HttpsError("internal", "학생 계정 생성 중 오류가 발생했습니다.");
  }

  return { ok: true, uid: userRecord.uid, campus, studentId, name, email };
});

exports.updateStudentIdentity = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const uid = typeof request.data?.uid === "string" ? request.data.uid.trim() : "";
  if (!uid) throw new HttpsError("invalid-argument", "학생 UID가 필요합니다.");

  const studentId = normalizeStudentId(request.data?.studentId);
  const campus = campusFromStudentId(studentId);
  const requestedCampus = typeof request.data?.campus === "string" ? request.data.campus.trim() : "";
  validateDisplayedCampus(requestedCampus, campus);
  const name = normalizeStudentName(request.data?.name);

  const [caller, targetSnap, authUser] = await Promise.all([
    getProfile(request.auth.uid),
    db.doc(`users/${uid}`).get(),
    auth.getUser(uid)
  ]);
  if (!targetSnap.exists) throw new HttpsError("not-found", "학생 문서를 찾을 수 없습니다.");
  const target = { uid, ...targetSnap.data() };
  if (target.role !== "student") throw new HttpsError("failed-precondition", "학생 계정이 아닙니다.");

  const master = caller.role === "master" && caller.active === true;
  const teacherAllowed = caller.role === "teacher"
    && caller.active === true
    && caller.canManageStudentInfo === true
    && target.campus === campus
    && hasCampusAccess(caller, target.campus);
  if (!master && !teacherAllowed) {
    throw new HttpsError("permission-denied", "이 학생의 로그인 정보를 수정할 권한이 없습니다.");
  }

  await ensureStudentCodeAvailable(studentId, uid);
  const email = studentAccountEmail(studentId);
  try {
    const existing = await auth.getUserByEmail(email);
    if (existing.uid !== uid) throw new HttpsError("already-exists", `${studentId} 로그인 계정이 이미 있습니다.`);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error.code !== "auth/user-not-found") throw error;
  }

  const oldEmail = authUser.email;
  const oldDisplayName = authUser.displayName;
  try {
    await auth.updateUser(uid, {
      email,
      emailVerified: true,
      displayName: `${studentId} ${name}`
    });

    const batch = db.batch();
    batch.set(db.doc(`users/${uid}`), {
      campus,
      studentId,
      name,
      email,
      loginKey: studentId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid
    }, { merge: true });
    batch.set(db.collection("auditLogs").doc(), {
      action: "student_identity_updated",
      targetUid: uid,
      previousCampus: target.campus || "",
      campus,
      previousStudentId: target.studentId || "",
      targetStudentId: studentId,
      actorUid: request.auth.uid,
      actorRole: caller.role,
      createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();

    const questionSnap = await db.collection("questions").where("studentUid", "==", uid).get();
    for (let start = 0; start < questionSnap.docs.length; start += 400) {
      const questionBatch = db.batch();
      questionSnap.docs.slice(start, start + 400).forEach((questionDoc) => {
        questionBatch.set(questionDoc.ref, {
          campus,
          studentId,
          studentName: name,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      });
      await questionBatch.commit();
    }
  } catch (error) {
    try {
      await auth.updateUser(uid, {
        email: oldEmail,
        displayName: oldDisplayName || undefined
      });
    } catch (rollbackError) {
      console.error("학생 로그인정보 롤백 실패", rollbackError);
    }
    if (error instanceof HttpsError) throw error;
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", `${studentId} 로그인 계정이 이미 있습니다.`);
    }
    console.error(error);
    throw new HttpsError("internal", "학생 로그인정보 수정 중 오류가 발생했습니다.");
  }

  return { ok: true, uid, campus, studentId, name, email };
});

exports.resetStudentPassword = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const uid = typeof request.data?.uid === "string" ? request.data.uid.trim() : "";
  const newPassword = typeof request.data?.newPassword === "string" ? request.data.newPassword : "";
  if (!uid) throw new HttpsError("invalid-argument", "학생 UID가 필요합니다.");
  if (newPassword.length < 8 || newPassword.length > 64) {
    throw new HttpsError("invalid-argument", "임시 비밀번호는 8~64자여야 합니다.");
  }

  const [caller, targetSnap] = await Promise.all([
    getProfile(request.auth.uid),
    db.doc(`users/${uid}`).get()
  ]);

  if (!targetSnap.exists) throw new HttpsError("not-found", "학생 문서를 찾을 수 없습니다.");
  const target = { uid, ...targetSnap.data() };
  if (target.role !== "student") throw new HttpsError("failed-precondition", "학생 계정이 아닙니다.");
  if (!VALID_CAMPUSES.has(target.campus)) throw new HttpsError("failed-precondition", "학생 소속관이 올바르지 않습니다.");

  const allowed = (caller.role === "master" && caller.active === true)
    || (
      caller.role === "teacher"
      && caller.active === true
      && caller.canResetStudentPassword === true
      && hasCampusAccess(caller, target.campus)
    );
  if (!allowed) throw new HttpsError("permission-denied", "이 학생의 비밀번호를 재발급할 권한이 없습니다.");

  await auth.updateUser(uid, { password: newPassword });

  const batch = db.batch();
  batch.set(db.doc(`users/${uid}`), {
    mustChangePassword: true,
    passwordResetAt: FieldValue.serverTimestamp(),
    passwordResetBy: request.auth.uid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid
  }, { merge: true });
  batch.set(db.collection("auditLogs").doc(), {
    action: "student_password_reset",
    targetUid: uid,
    targetStudentId: target.studentId || "",
    campus: target.campus,
    actorUid: request.auth.uid,
    actorRole: caller.role,
    createdAt: FieldValue.serverTimestamp()
  });
  await batch.commit();

  return { ok: true, uid, campus: target.campus };
});


function normalizeApplicationCampus(value) {
  const campus = typeof value === "string" ? value.trim() : "";
  if (!VALID_CAMPUSES.has(campus)) {
    throw new HttpsError("invalid-argument", "신청 소속관이 올바르지 않습니다.");
  }
  return campus;
}

function normalizeApplicationContact(value) {
  const contactLast4 = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}$/.test(contactLast4)) {
    throw new HttpsError("invalid-argument", "연락처 뒤 4자리를 숫자로 입력하세요.");
  }
  return contactLast4;
}

function studentApplicationId(campus, name, contactLast4) {
  return crypto.createHash("sha256")
    .update([campus, name.toLowerCase(), contactLast4].join("|"))
    .digest("hex");
}

function canReviewStudentApplications(profile, campus) {
  return canCreateStudent(profile, campus);
}

exports.requestStudentApplication = onCall(async (request) => {
  const campus = normalizeApplicationCampus(request.data?.campus);
  const name = normalizeStudentName(request.data?.name);
  const contactLast4 = normalizeApplicationContact(request.data?.contactLast4);
  const id = studentApplicationId(campus, name, contactLast4);
  const applicationCode = id.slice(0, 8).toUpperCase();
  const ref = db.doc(`studentApplications/${id}`);
  const existing = await ref.get();

  if (existing.exists) {
    const previous = existing.data();
    if (previous.status === "pending") {
      return { ok: true, id, applicationCode, campus, name, status: "pending", duplicate: true };
    }
    if (previous.status === "approved") {
      throw new HttpsError("already-exists", "이미 승인된 학생 신청입니다.");
    }
  }

  await ref.set({
    campus,
    name,
    contactLast4,
    applicationCode,
    status: "pending",
    requestedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return { ok: true, id, applicationCode, campus, name, status: "pending" };
});

exports.listStudentApplications = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const caller = await getProfile(request.auth.uid);
  const master = caller.role === "master" && caller.active === true;
  const teacherApprover = caller.role === "teacher"
    && caller.active === true
    && caller.canApproveStudents === true;
  if (!master && !teacherApprover) {
    throw new HttpsError("permission-denied", "학생 신청을 확인할 권한이 없습니다.");
  }

  const allowed = master
    ? [...VALID_CAMPUSES]
    : (Array.isArray(caller.allowedCampuses) ? caller.allowedCampuses : []).filter((campus) => VALID_CAMPUSES.has(campus));
  if (!allowed.length) return { ok: true, applications: [] };

  const snap = await db.collection("studentApplications")
    .where("status", "==", "pending")
    .limit(100)
    .get();

  const applications = snap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((row) => allowed.includes(row.campus))
    .sort((a, b) => (a.requestedAt?.toMillis?.() ?? 0) - (b.requestedAt?.toMillis?.() ?? 0))
    .map((row) => ({
      id: row.id,
      applicationCode: row.applicationCode || row.id.slice(0, 8).toUpperCase(),
      campus: row.campus,
      name: row.name,
      contactLast4: row.contactLast4,
      status: row.status,
      requestedAt: row.requestedAt?.toDate?.().toISOString() ?? null
    }));

  return { ok: true, applications };
});

exports.approveStudentApplication = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const applicationId = typeof request.data?.applicationId === "string" ? request.data.applicationId.trim() : "";
  if (!/^[a-f0-9]{64}$/.test(applicationId)) {
    throw new HttpsError("invalid-argument", "학생 신청번호가 올바르지 않습니다.");
  }

  const studentId = normalizeStudentId(request.data?.studentId);
  const campus = campusFromStudentId(studentId);
  const password = typeof request.data?.password === "string" ? request.data.password : "";
  if (password.length < 8 || password.length > 64) {
    throw new HttpsError("invalid-argument", "임시 비밀번호는 8~64자로 입력하세요.");
  }

  const applicationRef = db.doc(`studentApplications/${applicationId}`);
  const [caller, applicationSnap] = await Promise.all([
    getProfile(request.auth.uid),
    applicationRef.get()
  ]);
  if (!applicationSnap.exists) throw new HttpsError("not-found", "학생 신청을 찾을 수 없습니다.");
  const application = applicationSnap.data();
  if (application.status !== "pending") {
    throw new HttpsError("failed-precondition", "이미 처리된 학생 신청입니다.");
  }
  if (!VALID_CAMPUSES.has(application.campus) || campus !== application.campus) {
    throw new HttpsError("invalid-argument", `${campusLabel(application.campus)} 학생코드와 소속관이 일치하지 않습니다.`);
  }
  if (!canReviewStudentApplications(caller, application.campus)) {
    throw new HttpsError("permission-denied", "이 소속관의 학생 신청을 승인할 권한이 없습니다.");
  }

  const name = normalizeStudentName(request.data?.name || application.name);
  const email = studentAccountEmail(studentId);
  await ensureStudentCodeAvailable(studentId);
  try {
    await auth.getUserByEmail(email);
    throw new HttpsError("already-exists", `${studentId} 로그인 계정이 이미 있습니다.`);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error.code !== "auth/user-not-found") throw error;
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email,
      emailVerified: true,
      password,
      displayName: `${studentId} ${name}`,
      disabled: false
    });

    const batch = db.batch();
    batch.set(db.doc(`users/${userRecord.uid}`), {
      role: "student",
      active: true,
      campus,
      studentId,
      name,
      email,
      loginKey: studentId,
      mustChangePassword: true,
      studentApplicationId: applicationId,
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid
    });
    batch.update(applicationRef, {
      status: "approved",
      assignedStudentId: studentId,
      studentUid: userRecord.uid,
      approvedName: name,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: request.auth.uid,
      updatedAt: FieldValue.serverTimestamp()
    });
    batch.set(db.collection("auditLogs").doc(), {
      action: "student_application_approved",
      applicationId,
      targetUid: userRecord.uid,
      targetStudentId: studentId,
      campus,
      actorUid: request.auth.uid,
      actorRole: caller.role,
      createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();
  } catch (error) {
    if (userRecord?.uid) {
      try { await auth.deleteUser(userRecord.uid); }
      catch (cleanupError) { console.error("학생 승인 계정 정리 실패", cleanupError); }
    }
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", `${studentId} 로그인 계정이 이미 있습니다.`);
    }
    if (error instanceof HttpsError) throw error;
    console.error(error);
    throw new HttpsError("internal", "학생 신청 승인 중 오류가 발생했습니다.");
  }

  return { ok: true, uid: userRecord.uid, campus, studentId, name };
});

exports.rejectStudentApplication = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const applicationId = typeof request.data?.applicationId === "string" ? request.data.applicationId.trim() : "";
  if (!/^[a-f0-9]{64}$/.test(applicationId)) {
    throw new HttpsError("invalid-argument", "학생 신청번호가 올바르지 않습니다.");
  }

  const applicationRef = db.doc(`studentApplications/${applicationId}`);
  const [caller, applicationSnap] = await Promise.all([
    getProfile(request.auth.uid),
    applicationRef.get()
  ]);
  if (!applicationSnap.exists) throw new HttpsError("not-found", "학생 신청을 찾을 수 없습니다.");
  const application = applicationSnap.data();
  if (application.status !== "pending") {
    throw new HttpsError("failed-precondition", "이미 처리된 학생 신청입니다.");
  }
  if (!canReviewStudentApplications(caller, application.campus)) {
    throw new HttpsError("permission-denied", "이 소속관의 학생 신청을 반려할 권한이 없습니다.");
  }

  await applicationRef.update({
    status: "rejected",
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: request.auth.uid,
    updatedAt: FieldValue.serverTimestamp()
  });
  await db.collection("auditLogs").add({
    action: "student_application_rejected",
    applicationId,
    campus: application.campus,
    actorUid: request.auth.uid,
    actorRole: caller.role,
    createdAt: FieldValue.serverTimestamp()
  });

  return { ok: true };
});
