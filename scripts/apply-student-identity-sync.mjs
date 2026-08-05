import fs from "node:fs";

const path = "question-access/teacher.js";
let source = fs.readFileSync(path, "utf8");

const oldImport = 'import { db, resetStudentPasswordCallable } from "./firebase-client.js";';
const newImport = 'import { db, resetStudentPasswordCallable, updateStudentIdentityCallable } from "./firebase-client.js";';
if (!source.includes(oldImport) && !source.includes(newImport)) {
  throw new Error("firebase-client import pattern not found");
}
source = source.replace(oldImport, newImport);

function replaceBlock(startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`block not found: ${startMarker}`);
  source = source.slice(0, start) + replacement + source.slice(end);
}

replaceBlock(
  "async function changeStudentCampus(uid) {",
  "\nasync function setStudentActive(uid, active) {",
`async function changeStudentCampus(uid) {
  const student = state.approvedStudents.find((x) => x.uid === uid);
  if (!student || !isMaster()) return;
  const current = student.campus === "suseong2" ? "2" : "1";
  const input = prompt("소속관을 입력하세요. 수성1관=1, 수성2관=2", current);
  if (input === null) return;
  const campus = input.trim() === "1" ? "suseong1" : input.trim() === "2" ? "suseong2" : "";
  if (!campus) {
    showStatus("소속관은 1 또는 2로 입력하세요.", "warning");
    return;
  }
  if (campus === student.campus) {
    showStatus("현재 소속관과 같습니다.", "warning");
    return;
  }
  if (!student.studentId || !student.name) {
    showStatus("소속관을 옮기기 전에 학생번호와 이름을 먼저 확인하세요.", "warning");
    return;
  }

  try {
    showStatus("소속관과 학생 로그인 계정을 함께 변경하는 중입니다.");
    await timeout(updateStudentIdentityCallable({
      uid,
      campus,
      studentId: student.studentId,
      name: student.name
    }), 25000, "소속관 변경 시간이 초과되었습니다.");

    const questions = state.teacherQuestions.filter((q) => q.studentUid === uid);
    student.campus = campus;
    questions.forEach((q) => {
      q.campus = campus;
      q.studentId = student.studentId;
      q.studentName = student.name;
    });
    showStatus(\\`${student.studentId}의 소속과 로그인 계정을 ${campusLabel(campus)}으로 변경했습니다.\\`, "success");
    renderStudentDirectory();
    renderTeacherQuestions();
  } catch (error) {
    showStatus(\\`소속관 변경에 실패했습니다.\\n${error.code ?? ""} ${error.message ?? String(error)}\\`, "error");
  }
}
`
);

replaceBlock(
  "async function editStudentInfo(uid) {",
  "\nfunction generateTemporaryPassword() {",
`async function editStudentInfo(uid) {
  const student = state.approvedStudents.find((x) => x.uid === uid);
  if (!student || !student.campus) return;
  const studentId = prompt("학생번호를 입력하세요. (M001~M100)", (student.studentId || "").toUpperCase())?.trim().toUpperCase();
  if (studentId == null) return;
  if (!/^M(00[1-9]|0[1-9][0-9]|100)$/.test(studentId)) {
    showStatus("학생번호는 M001부터 M100까지 입력하세요.", "warning");
    return;
  }
  if (state.approvedStudents.some((x) => x.uid !== uid && x.campus === student.campus && (x.studentId || "").toUpperCase() === studentId)) {
    showStatus(\\`${campusLabel(student.campus)} ${studentId}는 이미 사용 중입니다.\\`, "error");
    return;
  }
  const name = prompt("학생 이름을 입력하세요.", student.name || "")?.trim();
  if (!name) {
    showStatus("학생 이름을 입력하세요.", "warning");
    return;
  }

  try {
    showStatus("학생번호·이름과 로그인 계정을 함께 수정하는 중입니다.");
    await timeout(updateStudentIdentityCallable({
      uid,
      campus: student.campus,
      studentId,
      name
    }), 25000, "학생정보 저장 시간이 초과되었습니다.");
    student.studentId = studentId;
    student.name = name;
    state.teacherQuestions.filter((q) => q.studentUid === uid).forEach((q) => {
      q.studentId = studentId;
      q.studentName = name;
    });
    showStatus(\\`${campusLabel(student.campus)} ${studentId} · ${name} 정보와 로그인 계정을 저장했습니다.\\`, "success");
    renderStudentDirectory();
    renderTeacherQuestions();
  } catch (error) {
    showStatus(\\`학생정보 수정에 실패했습니다.\\n${error.code ?? ""} ${error.message ?? String(error)}\\`, "error");
  }
}
`
);

fs.writeFileSync(path, source);
console.log("teacher.js identity synchronization patch applied");
