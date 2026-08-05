import fs from "node:fs";

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Could not patch ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// 1. Initial student application UI and approval panel.
{
  const path = "question-access/index.html";
  let source = fs.readFileSync(path, "utf8");

  const studentCard = `      <section class="login-card student-entry-card">
        <h2>학생 이용 신청</h2>
        <p>처음 이용하는 학생은 신청서를 먼저 제출합니다. 승인 담당자가 확인한 뒤 학생코드와 임시 비밀번호를 부여합니다.</p>
        <form id="studentApplicationForm">
          <label for="studentApplicationCampus">신청 소속관</label>
          <select id="studentApplicationCampus" required>
            <option value="">소속관을 선택하세요</option>
            <option value="suseong1">수성1관</option>
            <option value="suseong2">수성2관</option>
          </select>
          <label for="studentApplicationName">학생 이름</label>
          <input id="studentApplicationName" type="text" maxlength="40" autocomplete="name" required>
          <label for="studentApplicationContact">연락처 뒤 4자리</label>
          <input id="studentApplicationContact" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="동명이인 확인용" required>
          <button id="studentApplicationSubmit" class="student-login" type="submit">학생 이용 신청</button>
        </form>
        <div id="studentApplicationResult" class="status hidden" aria-live="polite"></div>

        <details class="student-login-details">
          <summary>이미 승인받은 학생 로그인</summary>
          <p>마스터 또는 승인 담당자에게 받은 학생코드와 임시 비밀번호를 입력합니다.</p>
          <form id="studentLoginForm">
            <label for="studentCampus">소속관</label>
            <select id="studentCampus" required>
              <option value="">소속관을 선택하세요</option>
              <option value="suseong1">수성1관</option>
              <option value="suseong2">수성2관</option>
            </select>
            <label for="studentId">학생코드</label>
            <input id="studentId" type="text" autocomplete="username" placeholder="1관 M001 / 2관 S001" maxlength="4" required>
            <label for="studentPassword">비밀번호</label>
            <input id="studentPassword" type="password" autocomplete="current-password" minlength="8" required>
            <button class="student-login" type="submit">승인 학생 로그인</button>
          </form>
          <p class="login-rule">수성1관은 M001~M199, 수성2관은 S001~S199입니다.</p>
        </details>
      </section>`;

  source = replaceBetween(
    source,
    `      <section class="login-card">\n        <h2>학생 로그인</h2>`,
    `\n    </div>`,
    studentCard,
    "student entry card"
  );

  const approvalPanel = `      <section id="studentApprovalPanel" class="account-create-box hidden">
        <h2>학생 신청 승인</h2>
        <p>학생 신청을 확인한 뒤 소속관에 맞는 학생코드와 임시 비밀번호를 부여해 승인합니다.</p>
        <div id="studentApplicationList" class="list"></div>
      </section>`;

  source = replaceBetween(
    source,
    `      <section id="studentAccountPanel" class="account-create-box hidden">`,
    `\n\n      <div class="directory-head">`,
    approvalPanel,
    "student approval panel"
  );

  fs.writeFileSync(path, source);
}

// 2. Callable function bindings.
{
  const path = "question-access/firebase-client.js";
  let source = fs.readFileSync(path, "utf8");
  const marker = `export const resetStudentPasswordCallable = httpsCallable(functions, "resetStudentPassword");`;
  const addition = `${marker}\nexport const requestStudentApplicationCallable = httpsCallable(functions, "requestStudentApplication");\nexport const listStudentApplicationsCallable = httpsCallable(functions, "listStudentApplications");\nexport const approveStudentApplicationCallable = httpsCallable(functions, "approveStudentApplication");\nexport const rejectStudentApplicationCallable = httpsCallable(functions, "rejectStudentApplication");`;
  if (!source.includes("requestStudentApplicationCallable")) {
    if (!source.includes(marker)) throw new Error("Could not patch firebase-client.js");
    source = source.replace(marker, addition);
  }
  fs.writeFileSync(path, source);
}

// 3. DOM references.
{
  const path = "question-access/shared.js";
  let source = fs.readFileSync(path, "utf8");
  source = source.replace(
    `  studentLoginForm: $("studentLoginForm"), googleLoginButton: $("googleLoginButton"),\n  googleSwitchButton: $("googleSwitchButton"),`,
    `  studentApplicationForm: $("studentApplicationForm"),\n  studentApplicationResult: $("studentApplicationResult"),\n  studentApplicationSubmit: $("studentApplicationSubmit"),\n  studentLoginForm: $("studentLoginForm"), googleLoginButton: $("googleLoginButton"),\n  googleSwitchButton: $("googleSwitchButton"),`
  );
  source = source.replace(
    `  teacherRequestList: $("teacherRequestList"), approvedTeacherList: $("approvedTeacherList"),`,
    `  teacherRequestList: $("teacherRequestList"), approvedTeacherList: $("approvedTeacherList"),\n  studentApprovalPanel: $("studentApprovalPanel"), studentApplicationList: $("studentApplicationList"),`
  );
  if (!source.includes("studentApplicationForm") || !source.includes("studentApprovalPanel")) {
    throw new Error("Could not patch shared.js");
  }
  fs.writeFileSync(path, source);
}

// 4. App wiring and role-based application loading.
{
  const path = "question-access/app.js";
  let source = fs.readFileSync(path, "utf8");
  source = source.replace(
    `import { studentLogin, loadStudentQuestions, submitQuestion } from "./student.js";`,
    `import { studentLogin, loadStudentQuestions, submitQuestion } from "./student.js";\nimport { submitStudentApplication } from "./student-application.js";\nimport { configureStudentApprovalPanel, loadStudentApplications } from "./student-approval.js";`
  );
  source = source.replace(`import { configureStudentAccountPanel } from "./student-account.js";\n`, "");
  source = source.replaceAll("configureStudentAccountPanel();", "configureStudentApprovalPanel();");
  source = source.replace(
    `      await loadTeacherWorkspace();\n      return;`,
    `      await Promise.all([loadTeacherWorkspace(), loadStudentApplications()]);\n      return;`
  );
  source = source.replace(
    `      await Promise.all([loadTeacherRequests(), loadApprovedTeachers(), loadTeacherWorkspace()]);`,
    `      await Promise.all([loadTeacherRequests(), loadApprovedTeachers(), loadTeacherWorkspace(), loadStudentApplications()]);`
  );
  source = source.replace(
    `els.studentLoginForm.addEventListener("submit", studentLogin);`,
    `els.studentApplicationForm.addEventListener("submit", submitStudentApplication);\nels.studentLoginForm.addEventListener("submit", studentLogin);`
  );
  if (!source.includes("submitStudentApplication") || !source.includes("loadStudentApplications")) {
    throw new Error("Could not patch app.js");
  }
  fs.writeFileSync(path, source);
}

// 5. Public application, protected listing, approval and rejection Cloud Functions.
{
  const path = "functions/index.js";
  let source = fs.readFileSync(path, "utf8");
  if (!source.includes(`require("node:crypto")`)) {
    source = `const crypto = require("node:crypto");\n` + source;
  }

  if (!source.includes("exports.requestStudentApplication")) {
    source += `

function normalizeApplicationCampus(value) {
  const campus = typeof value === "string" ? value.trim() : "";
  if (!VALID_CAMPUSES.has(campus)) {
    throw new HttpsError("invalid-argument", "신청 소속관이 올바르지 않습니다.");
  }
  return campus;
}

function normalizeApplicationContact(value) {
  const contactLast4 = typeof value === "string" ? value.trim() : "";
  if (!/^\\d{4}$/.test(contactLast4)) {
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
  const ref = db.doc(\`studentApplications/\${id}\`);
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

  const applicationRef = db.doc(\`studentApplications/\${applicationId}\`);
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
    throw new HttpsError("invalid-argument", \`\${campusLabel(application.campus)} 학생코드와 소속관이 일치하지 않습니다.\`);
  }
  if (!canReviewStudentApplications(caller, application.campus)) {
    throw new HttpsError("permission-denied", "이 소속관의 학생 신청을 승인할 권한이 없습니다.");
  }

  const name = normalizeStudentName(request.data?.name || application.name);
  const email = studentAccountEmail(studentId);
  await ensureStudentCodeAvailable(studentId);
  try {
    await auth.getUserByEmail(email);
    throw new HttpsError("already-exists", \`\${studentId} 로그인 계정이 이미 있습니다.\`);
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
      displayName: \`\${studentId} \${name}\`,
      disabled: false
    });

    const batch = db.batch();
    batch.set(db.doc(\`users/\${userRecord.uid}\`), {
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
      throw new HttpsError("already-exists", \`\${studentId} 로그인 계정이 이미 있습니다.\`);
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

  const applicationRef = db.doc(\`studentApplications/\${applicationId}\`);
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
`;
  }
  fs.writeFileSync(path, source);
}

// 6. Styling for application-first onboarding.
{
  const path = "question-access/styles.css";
  let source = fs.readFileSync(path, "utf8");
  const addition = `.teacher-login-card{border:2px solid #2563eb;background:#eff6ff}.teacher-login-card #googleLoginButton{width:100%;margin-top:16px}.student-entry-card>p{margin-bottom:4px}.student-login-details{margin-top:20px;padding:14px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc}.student-login-details summary{cursor:pointer;font-weight:900;color:#1e40af}.student-login-details[open] summary{margin-bottom:10px}.student-application-item .meta{margin-bottom:14px}.student-approval-form{display:grid;grid-template-columns:1.2fr 1fr 1.4fr;gap:12px;margin-top:14px}.student-approval-form label{margin-top:0}@media(max-width:760px){.student-approval-form{grid-template-columns:1fr}}`;
  if (!source.includes(".student-login-details")) source += addition;
  fs.writeFileSync(path, source);
}

console.log("Student application-first onboarding flow applied.");
