import {
  approveStudentApplicationCallable,
  listStudentApplicationsCallable,
  rejectStudentApplicationCallable
} from "./firebase-client.js";
import {
  STUDENT_CODE_PATTERN, allowedCampuses, campusFromStudentId, campusLabel,
  canApproveStudents, els, showStatus, studentCodeRange, timeout
} from "./shared.js";
import { loadTeacherWorkspace } from "./teacher.js";

function generateInitialPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);
  return `E247-${[...values].map((n) => chars[n % chars.length]).join("")}`;
}

function formatRequestedAt(value) {
  if (!value) return "접수시간 확인 중";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "접수시간 확인 중" : date.toLocaleString("ko-KR");
}

export function configureStudentApprovalPanel() {
  const enabled = canApproveStudents() && allowedCampuses().length > 0;
  els.studentApprovalPanel.classList.toggle("hidden", !enabled);
  if (!enabled) els.studentApplicationList.innerHTML = "";
  return enabled;
}

export async function loadStudentApplications() {
  if (!configureStudentApprovalPanel()) return;

  els.studentApplicationList.innerHTML = "<div class='status'>학생 이용 신청을 불러오는 중입니다.</div>";
  try {
    const response = await timeout(
      listStudentApplicationsCallable({}),
      15000,
      "학생 신청 목록 조회 시간이 초과되었습니다."
    );
    const rows = Array.isArray(response.data?.applications) ? response.data.applications : [];
    renderStudentApplications(rows);
  } catch (error) {
    els.studentApplicationList.innerHTML =
      `<div class="status error">학생 신청 목록을 읽지 못했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}</div>`;
  }
}

function renderStudentApplications(rows) {
  els.studentApplicationList.innerHTML = "";
  if (!rows.length) {
    els.studentApplicationList.innerHTML = "<div class='status success'>승인 대기 중인 학생 신청이 없습니다.</div>";
    return;
  }

  rows.forEach((application) => {
    const item = document.createElement("article");
    item.className = "item student-application-item";

    const title = document.createElement("h3");
    title.textContent = `${campusLabel(application.campus)} · ${application.name}`;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent =
      `신청 확인번호: ${application.applicationCode}\n` +
      `연락처 뒤 4자리: ${application.contactLast4}\n` +
      `접수: ${formatRequestedAt(application.requestedAt)}`;

    const form = document.createElement("div");
    form.className = "student-approval-form";

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "학생 이름";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = 40;
    nameInput.value = application.name;
    nameLabel.appendChild(nameInput);

    const codeLabel = document.createElement("label");
    codeLabel.textContent = "부여할 학생코드";
    const codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.maxLength = 4;
    codeInput.placeholder = application.campus === "suseong1" ? "M001" : "S001";
    codeInput.addEventListener("input", () => {
      codeInput.value = codeInput.value.trim().toUpperCase();
    });
    codeLabel.appendChild(codeInput);

    const passwordLabel = document.createElement("label");
    passwordLabel.textContent = "임시 비밀번호";
    const passwordInput = document.createElement("input");
    passwordInput.type = "text";
    passwordInput.minLength = 8;
    passwordInput.maxLength = 64;
    passwordInput.value = generateInitialPassword();
    passwordLabel.appendChild(passwordInput);

    form.append(nameLabel, codeLabel, passwordLabel);

    const actions = document.createElement("div");
    actions.className = "actions";
    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "approve";
    approve.textContent = "번호·비밀번호 부여 후 승인";
    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "reject";
    reject.textContent = "신청 반려";

    approve.addEventListener("click", async () => {
      const studentId = codeInput.value.trim().toUpperCase();
      const name = nameInput.value.trim();
      const password = passwordInput.value;
      if (!STUDENT_CODE_PATTERN.test(studentId)) {
        showStatus(`학생코드는 ${studentCodeRange(application.campus)} 범위에서 입력하세요.`, "warning");
        return;
      }
      if (campusFromStudentId(studentId) !== application.campus) {
        showStatus(`${campusLabel(application.campus)} 학생코드는 ${studentCodeRange(application.campus)}입니다.`, "warning");
        return;
      }
      if (name.length < 2 || name.length > 40) {
        showStatus("학생 이름을 2~40자로 입력하세요.", "warning");
        return;
      }
      if (password.length < 8 || password.length > 64) {
        showStatus("임시 비밀번호는 8~64자로 입력하세요.", "warning");
        return;
      }

      approve.disabled = true;
      reject.disabled = true;
      approve.textContent = "승인 처리 중…";
      try {
        const response = await timeout(
          approveStudentApplicationCallable({
            applicationId: application.id,
            studentId,
            name,
            password
          }),
          30000,
          "학생 승인 처리 시간이 초과되었습니다."
        );
        const data = response.data;
        item.innerHTML = "";
        const success = document.createElement("div");
        success.className = "status success";
        success.textContent =
          `${campusLabel(data.campus)} ${data.studentId} · ${data.name} 승인 완료\n\n` +
          `학생 로그인 코드: ${data.studentId}\n임시 비밀번호: ${password}\n\n` +
          "비밀번호는 서버에 평문으로 저장되지 않습니다. 지금 학생에게 전달하세요.";
        item.appendChild(success);
        showStatus(`${data.studentId} 학생 계정 승인과 발급이 완료되었습니다.`, "success");
        await loadTeacherWorkspace();
      } catch (error) {
        const code = error.code ?? "확인 불가";
        const message = code.includes("already-exists")
          ? "같은 학생코드가 이미 사용 중입니다. 다른 번호를 부여하세요."
          : error.message ?? String(error);
        showStatus(`학생 승인에 실패했습니다.\n오류 코드: ${code}\n${message}`, "error");
        approve.disabled = false;
        reject.disabled = false;
        approve.textContent = "번호·비밀번호 부여 후 승인";
      }
    });

    reject.addEventListener("click", async () => {
      if (!confirm(`${application.name} 학생 신청을 반려하시겠습니까?`)) return;
      approve.disabled = true;
      reject.disabled = true;
      try {
        await timeout(
          rejectStudentApplicationCallable({ applicationId: application.id }),
          15000,
          "학생 신청 반려 시간이 초과되었습니다."
        );
        item.remove();
        showStatus("학생 신청을 반려했습니다.", "warning");
        if (!els.studentApplicationList.children.length) {
          els.studentApplicationList.innerHTML = "<div class='status success'>승인 대기 중인 학생 신청이 없습니다.</div>";
        }
      } catch (error) {
        showStatus(`학생 신청 반려에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error");
        approve.disabled = false;
        reject.disabled = false;
      }
    });

    actions.append(approve, reject);
    item.append(title, meta, form, actions);
    els.studentApplicationList.appendChild(item);
  });
}
