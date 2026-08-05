import fs from "node:fs";

const path = "question-access/teacher.js";
let source = fs.readFileSync(path, "utf8");

source = source.replace(
  "questionsForStudent, selectedStudent, isMaster\n} from \"./shared.js\";",
  "questionsForStudent, selectedStudent, isMaster, STUDENT_CODE_PATTERN, campusFromStudentId,\n  studentCodeRange, codeForCampus\n} from \"./shared.js\";"
);
source = source.replaceAll("limit(300)", "limit(450)");
source = source.replaceAll("limit(250)", "limit(450)");

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
    showStatus("소속관과 학생 로그인 코드를 함께 변경하는 중입니다.");
    await timeout(updateStudentIdentityCallable({
      uid,
      campus,
      studentId,
      name: student.name
    }), 25000, "소속관 변경 시간이 초과되었습니다.");

    const questions = state.teacherQuestions.filter((q) => q.studentUid === uid);
    student.campus = campus;
    student.studentId = studentId;
    questions.forEach((q) => {
      q.campus = campus;
      q.studentId = studentId;
      q.studentName = student.name;
    });
    showStatus(studentId + "로 변경하고 " + campusLabel(campus) + "으로 이동했습니다.", "success");
    renderStudentDirectory();
    renderTeacherQuestions();
  } catch (error) {
    showStatus("소속관 변경에 실패했습니다.\\n" + (error.code ?? "") + " " + (error.message ?? String(error)), "error");
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
  const guide = studentCodeRange(student.campus);
  const studentId = prompt("학생코드를 입력하세요. (" + guide + ")", (student.studentId || "").toUpperCase())?.trim().toUpperCase();
  if (studentId == null) return;
  if (!STUDENT_CODE_PATTERN.test(studentId)) {
    showStatus("학생코드는 수성1관 M001~M199 또는 수성2관 S001~S199로 입력하세요.", "warning");
    return;
  }
  if (campusFromStudentId(studentId) !== student.campus) {
    showStatus(campusLabel(student.campus) + " 학생코드는 " + guide + "입니다.", "warning");
    return;
  }
  if (state.approvedStudents.some((x) => x.uid !== uid && (x.studentId || "").toUpperCase() === studentId)) {
    showStatus(studentId + "는 이미 사용 중입니다.", "error");
    return;
  }
  const name = prompt("학생 이름을 입력하세요.", student.name || "")?.trim();
  if (!name) {
    showStatus("학생 이름을 입력하세요.", "warning");
    return;
  }

  try {
    showStatus("학생코드·이름과 로그인 계정을 함께 수정하는 중입니다.");
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
    showStatus(campusLabel(student.campus) + " " + studentId + " · " + name + " 정보와 로그인 계정을 저장했습니다.", "success");
    renderStudentDirectory();
    renderTeacherQuestions();
  } catch (error) {
    showStatus("학생정보 수정에 실패했습니다.\\n" + (error.code ?? "") + " " + (error.message ?? String(error)), "error");
  }
}
`
);

fs.writeFileSync(path, source);
console.log("teacher.js M/S student code patch applied");
