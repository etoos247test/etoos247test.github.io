import { createStudentAccountCallable } from "./firebase-client.js";
import {
  $, CAMPUSES, campusLabel, allowedCampuses, canApproveStudents, showStatus, timeout,
  STUDENT_CODE_PATTERN, campusFromStudentId, studentCodeRange, codeForCampus
} from "./shared.js";
import { loadTeacherWorkspace } from "./teacher.js";

const panel = $("studentAccountPanel");
const form = $("studentAccountForm");
const campusSelect = $("newStudentCampus");
const studentIdInput = $("newStudentId");
const result = $("studentAccountResult");
const submit = $("studentAccountSubmit");

function generateInitialPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);
  return `E247-${[...values].map((n) => chars[n % chars.length]).join("")}`;
}

function showResult(message, type = "success") {
  result.className = `status ${type}`;
  result.textContent = message;
}

function updateCodeGuide() {
  const campus = campusSelect.value;
  studentIdInput.placeholder = campus === "suseong1" ? "M001" : campus === "suseong2" ? "S001" : "M001 또는 S001";
  const current = studentIdInput.value.trim().toUpperCase();
  if (campus && current) studentIdInput.value = codeForCampus(campus, current);
}

export function configureStudentAccountPanel() {
  const campuses = allowedCampuses();
  const enabled = canApproveStudents() && campuses.length > 0;
  panel.classList.toggle("hidden", !enabled);
  result.classList.add("hidden");
  result.textContent = "";
  campusSelect.innerHTML = "";

  if (!enabled) return;

  campuses.forEach((id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = campusLabel(id);
    campusSelect.appendChild(option);
  });
  campusSelect.disabled = campuses.length === 1;
  $("newStudentPassword").value = generateInitialPassword();
  updateCodeGuide();
}

campusSelect.addEventListener("change", updateCodeGuide);
studentIdInput.addEventListener("input", () => {
  const value = studentIdInput.value.trim().toUpperCase();
  studentIdInput.value = value;
  const campus = campusFromStudentId(value);
  if (campus && [...campusSelect.options].some((option) => option.value === campus)) {
    campusSelect.value = campus;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedCampus = campusSelect.value;
  const studentId = studentIdInput.value.trim().toUpperCase();
  const codeCampus = campusFromStudentId(studentId);
  const name = $("newStudentName").value.trim();
  const password = $("newStudentPassword").value;

  if (!CAMPUSES.some((x) => x.id === selectedCampus)) {
    showResult("소속관을 선택하세요.", "warning");
    return;
  }
  if (!STUDENT_CODE_PATTERN.test(studentId)) {
    showResult("학생코드는 수성1관 M001~M199 또는 수성2관 S001~S199로 입력하세요.", "warning");
    return;
  }
  if (selectedCampus !== codeCampus) {
    showResult(`${campusLabel(selectedCampus)} 학생코드는 ${studentCodeRange(selectedCampus)}입니다.`, "warning");
    return;
  }
  if (name.length < 2) {
    showResult("학생 이름을 입력하세요.", "warning");
    return;
  }
  if (password.length < 8) {
    showResult("초기 비밀번호는 8자 이상이어야 합니다.", "warning");
    return;
  }

  submit.disabled = true;
  submit.textContent = "계정 생성 중…";
  result.classList.add("hidden");
  showStatus(`${campusLabel(codeCampus)} ${studentId} 학생 계정을 생성하는 중입니다.`);

  try {
    const response = await timeout(
      createStudentAccountCallable({ campus: selectedCampus, studentId, name, password }),
      25000,
      "학생 계정 생성 시간이 초과되었습니다."
    );
    const data = response.data;
    const successMessage =
      `${campusLabel(data.campus)} ${data.studentId} · ${data.name} 계정 생성 완료\n\n` +
      `로그인 코드: ${data.studentId}\n초기 비밀번호: ${password}\n\n` +
      "비밀번호는 저장되지 않으므로 지금 학생에게 전달하세요.";
    form.reset();
    configureStudentAccountPanel();
    showResult(successMessage, "success");
    await loadTeacherWorkspace();
  } catch (error) {
    const code = error.code ?? "확인 불가";
    const message = String(error.message ?? error);
    const friendly = code.includes("already-exists")
      ? "같은 학생코드가 이미 등록되어 있습니다."
      : code.includes("permission-denied")
        ? "이 소속관의 학생 계정을 생성할 권한이 없습니다."
        : message;
    showResult(`학생 계정 생성에 실패했습니다.\n오류 코드: ${code}\n${friendly}`, "error");
  } finally {
    submit.disabled = false;
    submit.textContent = "학생 계정 생성";
  }
});
