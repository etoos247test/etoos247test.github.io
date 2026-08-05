import { createStudentAccountCallable } from "./firebase-client.js";
import {
  $, CAMPUSES, campusLabel, allowedCampuses, canApproveStudents, showStatus, timeout
} from "./shared.js";
import { loadTeacherWorkspace } from "./teacher.js";

const panel = $("studentAccountPanel");
const form = $("studentAccountForm");
const campusSelect = $("newStudentCampus");
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
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const campus = campusSelect.value;
  const studentId = $("newStudentId").value.trim().toUpperCase();
  const name = $("newStudentName").value.trim();
  const password = $("newStudentPassword").value;

  if (!CAMPUSES.some((x) => x.id === campus)) {
    showResult("소속관을 선택하세요.", "warning");
    return;
  }
  if (!/^M(00[1-9]|0[1-9][0-9]|100)$/.test(studentId)) {
    showResult("학생번호는 M001부터 M100까지 입력하세요.", "warning");
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
  showStatus(`${campusLabel(campus)} ${studentId} 학생 계정을 생성하는 중입니다.`);

  try {
    const response = await timeout(
      createStudentAccountCallable({ campus, studentId, name, password }),
      25000,
      "학생 계정 생성 시간이 초과되었습니다."
    );
    const data = response.data;
    showResult(
      `${campusLabel(data.campus)} ${data.studentId} · ${data.name} 계정 생성 완료\n\n` +
      `로그인 번호: ${data.studentId}\n초기 비밀번호: ${password}\n\n` +
      "비밀번호는 저장되지 않으므로 지금 학생에게 전달하세요.",
      "success"
    );
    form.reset();
    configureStudentAccountPanel();
    showResult(
      `${campusLabel(data.campus)} ${data.studentId} · ${data.name} 계정 생성 완료\n\n` +
      `로그인 번호: ${data.studentId}\n초기 비밀번호: ${password}\n\n` +
      "비밀번호는 저장되지 않으므로 지금 학생에게 전달하세요.",
      "success"
    );
    await loadTeacherWorkspace();
  } catch (error) {
    const code = error.code ?? "확인 불가";
    const message = String(error.message ?? error);
    const friendly = code.includes("already-exists")
      ? "같은 소속관에 같은 학생번호가 이미 등록되어 있습니다. 다른 관의 같은 번호는 사용할 수 있습니다."
      : code.includes("permission-denied")
        ? "이 소속관의 학생 계정을 생성할 권한이 없습니다."
        : message;
    showResult(`학생 계정 생성에 실패했습니다.\n오류 코드: ${code}\n${friendly}`, "error");
  } finally {
    submit.disabled = false;
    submit.textContent = "학생 계정 생성";
  }
});
