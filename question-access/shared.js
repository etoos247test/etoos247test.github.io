export const $ = (id) => document.getElementById(id);
export const SUBJECTS = ["국어", "수학", "영어", "사탐", "과탐", "입시"];
export const CAMPUSES = [
  { id: "suseong1", label: "수성1관" },
  { id: "suseong2", label: "수성2관" }
];
export const STUDENT_CODE_PATTERN = /^[MS](00[1-9]|0[1-9][0-9]|1[0-9]{2})$/;
export const campusLabel = (id) => CAMPUSES.find((x) => x.id === id)?.label ?? "관 미지정";
export function campusFromStudentId(value) {
  const studentId = String(value ?? "").trim().toUpperCase();
  if (!STUDENT_CODE_PATTERN.test(studentId)) return "";
  return studentId.startsWith("M") ? "suseong1" : "suseong2";
}
export function studentCodeRange(campus) {
  return campus === "suseong1" ? "M001~M199" : campus === "suseong2" ? "S001~S199" : "M001~M199 또는 S001~S199";
}
export function codeForCampus(campus, value = "001") {
  const digits = String(value ?? "").replace(/\D/g, "").slice(-3).padStart(3, "0");
  const number = Number(digits);
  const safeDigits = number >= 1 && number <= 199 ? digits : "001";
  return `${campus === "suseong2" ? "S" : "M"}${safeDigits}`;
}

export const els = {
  loginArea: $("loginArea"), accountToolbar: $("accountToolbar"),
  studentLoginForm: $("studentLoginForm"), googleLoginButton: $("googleLoginButton"),
  refreshButton: $("refreshButton"), logoutButton: $("logoutButton"), status: $("status"),
  requestPanel: $("requestPanel"), requestText: $("requestText"), requestButton: $("requestButton"),
  studentPanel: $("studentPanel"), teacherPanel: $("teacherPanel"), masterPanel: $("masterPanel"),
  questionForm: $("questionForm"), studentQuestionList: $("studentQuestionList"),
  teacherQuestionList: $("teacherQuestionList"), teacherQuestionCount: $("teacherQuestionCount"),
  teacherRequestList: $("teacherRequestList"), approvedTeacherList: $("approvedTeacherList"),
  studentDirectorySummary: $("studentDirectorySummary"), studentDirectorySearch: $("studentDirectorySearch"),
  studentDirectoryList: $("studentDirectoryList"), selectedStudentTitle: $("selectedStudentTitle"),
  selectedStudentHelp: $("selectedStudentHelp"), teacherPermissionBadges: $("teacherPermissionBadges")
};

export const state = {
  currentUser: null, currentProfile: null, teacherQuestions: [], approvedStudents: [],
  selectedStudentUid: "all", selectedTeacherSubject: "all", selectedTeacherStatus: "waiting"
};

export function showStatus(message, type = "") {
  els.status.className = `status ${type}`.trim();
  els.status.textContent = message;
}
export function hidePanels() {
  [els.requestPanel, els.studentPanel, els.teacherPanel, els.masterPanel].forEach((p) => p.classList.add("hidden"));
  [els.studentQuestionList, els.teacherQuestionList, els.teacherRequestList, els.approvedTeacherList, els.studentDirectoryList].forEach((x) => x.innerHTML = "");
}
export function userSummary(user) {
  return [`이름: ${user.displayName ?? state.currentProfile?.name ?? "이름 정보 없음"}`, `이메일: ${user.email ?? "이메일 정보 없음"}`, `UID: ${user.uid}`].join("\n");
}
export function timestampValue(value) { return value?.toMillis?.() ?? 0; }
export function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "시간 확인 중";
}
export function timeout(promise, ms, message) { return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))]); }
export function isAnswered(data) { return data.status === "answered" && Boolean((data.answer ?? "").trim()); }
export function normalizedStatus(data) { return isAnswered(data) ? "answered" : "waiting"; }
export function isMaster() { return state.currentProfile?.role === "master" && state.currentProfile?.active === true; }
export function allowedCampuses() {
  if (isMaster()) return CAMPUSES.map((x) => x.id);
  const values = Array.isArray(state.currentProfile?.allowedCampuses) ? state.currentProfile.allowedCampuses : [];
  return CAMPUSES.map((x) => x.id).filter((id) => values.includes(id));
}
export function canAccessCampus(campus) { return isMaster() || allowedCampuses().includes(campus); }
export function canAnswerQuestions() { return isMaster() || state.currentProfile?.canAnswerQuestions === true || (state.currentProfile?.role === "teacher" && state.currentProfile?.canAnswerQuestions === undefined); }
export function canManageStudentInfo() { return isMaster() || state.currentProfile?.canManageStudentInfo === true; }
export function canApproveStudents() { return isMaster() || state.currentProfile?.canApproveStudents === true; }
export function canResetStudentPassword() { return isMaster() || state.currentProfile?.canResetStudentPassword === true; }
export function isQuasiMaster() { return !isMaster() && (canApproveStudents() || canManageStudentInfo() || canResetStudentPassword()); }
export function studentDisplay(student) {
  const fallback = state.teacherQuestions.find((q) => q.studentUid === student.uid);
  return {
    uid: student.uid,
    studentId: (student.studentId || fallback?.studentId || "번호 미입력").toUpperCase(),
    name: student.name || fallback?.studentName || "이름 미입력",
    campus: student.campus || fallback?.campus || ""
  };
}
export function questionsForStudent(uid) { return uid === "all" ? state.teacherQuestions : state.teacherQuestions.filter((q) => q.studentUid === uid); }
export function selectedStudent() {
  if (state.selectedStudentUid === "all") return null;
  const student = state.approvedStudents.find((x) => x.uid === state.selectedStudentUid);
  return student ? studentDisplay(student) : null;
}
