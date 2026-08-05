import fs from "node:fs";

function replaceRange(source, start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Patch marker missing: ${label}`);
  return source.slice(0, startIndex) + replacement + source.slice(endIndex);
}

// Remove obsolete student password permission from teacher approval controls.
{
  const path = "question-access/master.js";
  let source = fs.readFileSync(path, "utf8");
  source = source.replace(
    `    ["canManageStudentInfo", "학생번호·이름 수정", "허용된 관 학생의 번호와 이름만 수정합니다.", values.canManageStudentInfo === true],\n    ["canResetStudentPassword", "임시 비밀번호 재발급", "허용된 관 학생의 비밀번호를 보안 서버 함수로 재발급합니다.", values.canResetStudentPassword === true]\n`,
    `    ["canManageStudentInfo", "학생번호·이름 수정", "허용된 관 학생의 번호와 이름만 수정합니다.", values.canManageStudentInfo === true]\n`
  );
  fs.writeFileSync(path, source);
}

// Remove callable-function dependencies and use Firestore transactions for student identity changes.
{
  const path = "question-access/teacher.js";
  let source = fs.readFileSync(path, "utf8");

  source = source.replace(
    `  collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where, writeBatch\n`,
    `  collection, doc, getDocs, limit, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch\n`
  );
  source = source.replace(
    `import { db, resetStudentPasswordCallable, updateStudentIdentityCallable } from "./firebase-client.js";`,
    `import { db } from "./firebase-client.js";`
  );
  source = source.replace(
    `  canManageStudentInfo, canApproveStudents, canResetStudentPassword, studentDisplay,\n`,
    `  canManageStudentInfo, canApproveStudents, studentDisplay,\n`
  );
  source = source.replace(`    ["비밀번호", canResetStudentPassword()]\n`, "");
  source = source.replace(
    `  if (!student.isAll && (isMaster() || canApproveStudents() || canManageStudentInfo() || canResetStudentPassword())) {`,
    `  if (!student.isAll && (isMaster() || canApproveStudents() || canManageStudentInfo())) {`
  );

  source = source.replace(/\n    if \(canResetStudentPassword\(\) && active && student\.campus\) \{[\s\S]*?\n    \}\n\n    card\.appendChild\(actions\);/, `\n    card.appendChild(actions);`);

  const identityBlock = `async function persistStudentIdentity(uid, campus, studentId, name) {
  const student = state.approvedStudents.find((x) => x.uid === uid);
  if (!student) throw new Error("학생 정보를 찾을 수 없습니다.");
  const oldStudentId = String(student.studentId || "").trim().toUpperCase();

  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, "users", uid);
    const newCodeRef = doc(db, "studentCodes", studentId);
    const newCodeSnap = await transaction.get(newCodeRef);

    if (newCodeSnap.exists() && newCodeSnap.data().uid !== uid) {
      throw new Error(studentId + "는 이미 다른 학생에게 부여된 번호입니다.");
    }

    transaction.set(userRef, {
      campus,
      studentId,
      name,
      updatedAt: serverTimestamp(),
      updatedBy: state.currentUser.uid
    }, { merge: true });

    transaction.set(newCodeRef, {
      uid,
      campus,
      studentId,
      name,
      updatedAt: serverTimestamp(),
      updatedBy: state.currentUser.uid
    });

    if (oldStudentId && oldStudentId !== studentId && STUDENT_CODE_PATTERN.test(oldStudentId)) {
      transaction.delete(doc(db, "studentCodes", oldStudentId));
    }
  });

  const relatedQuestions = state.teacherQuestions.filter((q) => q.studentUid === uid);
  if (relatedQuestions.length) {
    const batch = writeBatch(db);
    relatedQuestions.forEach((question) => {
      batch.update(doc(db, "questions", question.id), {
        campus,
        studentId,
        studentName: name,
        updatedAt: serverTimestamp()
      });
    });
    await batch.commit();
  }

  student.campus = campus;
  student.studentId = studentId;
  student.name = name;
  relatedQuestions.forEach((question) => {
    question.campus = campus;
    question.studentId = studentId;
    question.studentName = name;
  });
}

async function changeStudentCampus(uid) {
  const student = state.approvedStudents.find((x) => x.uid === uid);
  if (!student || !isMaster()) return;
  const currentCampus = student.campus;
  const currentChoice = currentCampus === "suseong2" ? "2" : "1";
  const input = prompt("이동할 소속관을 입력하세요. 수성1관=1, 수성2관=2", currentChoice);
  if (input === null) return;
  const campus = input.trim() === "1" ? "suseong1" : input.trim() === "2" ? "suseong2" : "";
  if (!campus) {
    showStatus("소속관은 1 또는 2로 입력하세요.", "warning");
    return;
  }
  if (campus === currentCampus) {
    showStatus("현재 소속관과 같습니다.", "warning");
    return;
  }
  if (!student.name) {
    showStatus("소속관을 옮기기 전에 학생 이름을 먼저 확인하세요.", "warning");
    return;
  }

  const studentId = codeForCampus(campus, student.studentId);
  if (!confirm((student.studentId || "학생") + "을(를) " + studentId + "로 변경해 " + campusLabel(campus) + "으로 이동하시겠습니까?")) return;

  try {
    showStatus("소속관과 내부 학생번호를 함께 변경하는 중입니다.");
    await timeout(
      persistStudentIdentity(uid, campus, studentId, student.name),
      25000,
      "소속관 변경 시간이 초과되었습니다."
    );
    showStatus(studentId + "로 변경하고 " + campusLabel(campus) + "으로 이동했습니다.", "success");
    renderStudentDirectory();
    renderTeacherQuestions();
  } catch (error) {
    showStatus("소속관 변경에 실패했습니다.\\n" + (error.code ?? "") + " " + (error.message ?? String(error)), "error");
  }
}

`;

  source = replaceRange(
    source,
    `async function changeStudentCampus(uid) {`,
    `async function setStudentActive(uid, active) {`,
    identityBlock,
    "changeStudentCampus"
  );

  const editBlock = `async function editStudentInfo(uid) {
  const student = state.approvedStudents.find((x) => x.uid === uid);
  if (!student || !student.campus) return;
  const guide = studentCodeRange(student.campus);
  const studentId = prompt("내부 학생번호를 입력하세요. (" + guide + ")", (student.studentId || "").toUpperCase())?.trim().toUpperCase();
  if (studentId == null) return;
  if (!STUDENT_CODE_PATTERN.test(studentId)) {
    showStatus("학생번호는 수성1관 M001~M199 또는 수성2관 S001~S199로 입력하세요.", "warning");
    return;
  }
  if (campusFromStudentId(studentId) !== student.campus) {
    showStatus(campusLabel(student.campus) + " 학생번호는 " + guide + "입니다.", "warning");
    return;
  }
  const name = prompt("학생 이름을 입력하세요.", student.name || "")?.trim();
  if (!name) {
    showStatus("학생 이름을 입력하세요.", "warning");
    return;
  }

  try {
    showStatus("학생번호와 이름을 저장하는 중입니다.");
    await timeout(
      persistStudentIdentity(uid, student.campus, studentId, name),
      25000,
      "학생정보 저장 시간이 초과되었습니다."
    );
    showStatus(campusLabel(student.campus) + " " + studentId + " · " + name + " 정보를 저장했습니다.", "success");
    renderStudentDirectory();
    renderTeacherQuestions();
  } catch (error) {
    showStatus("학생정보 수정에 실패했습니다.\\n" + (error.code ?? "") + " " + (error.message ?? String(error)), "error");
  }
}

`;

  source = replaceRange(
    source,
    `async function editStudentInfo(uid) {`,
    `export function renderTeacherQuestions() {`,
    editBlock,
    "editStudentInfo"
  );

  if (source.includes("resetStudentPasswordCallable") || source.includes("canResetStudentPassword")) {
    throw new Error("Password dependencies remain in teacher.js");
  }

  fs.writeFileSync(path, source);
}

console.log("Teacher and master Google-student cleanup applied.");
