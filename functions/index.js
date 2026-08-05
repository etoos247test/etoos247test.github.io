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
const CAMPUS_EMAIL_PREFIX = {
  suseong1: "s1",
  suseong2: "s2"
};

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
  if (!/^M(00[1-9]|0[1-9][0-9]|100)$/.test(studentId)) {
    throw new HttpsError("invalid-argument", "학생번호는 M001부터 M100까지 입력해야 합니다.");
  }
  return studentId;
}

function studentAccountEmail(campus, studentId) {
  const prefix = CAMPUS_EMAIL_PREFIX[campus];
  if (!prefix) throw new HttpsError("invalid-argument", "소속관이 올바르지 않습니다.");
  return `${prefix}-${studentId.toLowerCase()}@etoos247test.local`;
}

function canCreateStudent(profile, campus) {
  return profile.role === "master"
    || (
      profile.role === "teacher"
      && profile.active === true
      && profile.canApproveStudents === true
      && hasCampusAccess(profile, campus)
    );
}

exports.createStudentAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const campus = typeof request.data?.campus === "string" ? request.data.campus.trim() : "";
  if (!VALID_CAMPUSES.has(campus)) throw new HttpsError("invalid-argument", "소속관을 선택하세요.");

  const studentId = normalizeStudentId(request.data?.studentId);
  const name = typeof request.data?.name === "string" ? request.data.name.trim() : "";
  const password = typeof request.data?.password === "string" ? request.data.password : "";
  if (name.length < 2 || name.length > 40) throw new HttpsError("invalid-argument", "학생 이름은 2~40자로 입력하세요.");
  if (password.length < 8 || password.length > 64) throw new HttpsError("invalid-argument", "초기 비밀번호는 8~64자로 입력하세요.");

  const caller = await getProfile(request.auth.uid);
  if (!canCreateStudent(caller, campus)) {
    throw new HttpsError("permission-denied", "이 소속관의 학생 계정을 생성할 권한이 없습니다.");
  }

  const email = studentAccountEmail(campus, studentId);
  const duplicate = await db.collection("users")
    .where("role", "==", "student")
    .where("campus", "==", campus)
    .where("studentId", "==", studentId)
    .limit(1)
    .get();
  if (!duplicate.empty) {
    throw new HttpsError("already-exists", `${campus === "suseong1" ? "수성1관" : "수성2관"} ${studentId} 계정이 이미 있습니다.`);
  }

  try {
    await auth.getUserByEmail(email);
    throw new HttpsError("already-exists", "같은 소속관과 학생번호의 로그인 계정이 이미 있습니다.");
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
      loginKey: `${campus}_${studentId}`,
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
      try { await auth.deleteUser(userRecord.uid); } catch (cleanupError) { console.error("학생 계정 정리 실패", cleanupError); }
    }
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "같은 소속관과 학생번호의 로그인 계정이 이미 있습니다.");
    }
    if (error instanceof HttpsError) throw error;
    console.error(error);
    throw new HttpsError("internal", "학생 계정 생성 중 오류가 발생했습니다.");
  }

  return {
    ok: true,
    uid: userRecord.uid,
    campus,
    studentId,
    name,
    email
  };
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

  const allowed = caller.role === "master"
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
