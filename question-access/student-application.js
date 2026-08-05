import { requestStudentApplicationCallable } from "./firebase-client.js";
import { $, campusLabel, els, showStatus, timeout } from "./shared.js";

function showApplicationResult(message, type = "success") {
  els.studentApplicationResult.className = `status ${type}`;
  els.studentApplicationResult.textContent = message;
}

export async function submitStudentApplication(event) {
  event.preventDefault();

  const campus = $("studentApplicationCampus").value;
  const name = $("studentApplicationName").value.trim();
  const contactLast4 = $("studentApplicationContact").value.trim();
  const button = els.studentApplicationSubmit;

  if (!campus) {
    showApplicationResult("신청할 소속관을 선택하세요.", "warning");
    return;
  }
  if (name.length < 2 || name.length > 40) {
    showApplicationResult("학생 이름을 2~40자로 입력하세요.", "warning");
    return;
  }
  if (!/^\d{4}$/.test(contactLast4)) {
    showApplicationResult("동명이인 확인을 위해 연락처 뒤 4자리를 숫자로 입력하세요.", "warning");
    return;
  }

  button.disabled = true;
  button.textContent = "신청 접수 중…";
  showStatus(`${campusLabel(campus)} 학생 이용 신청을 접수하는 중입니다.`);

  try {
    const response = await timeout(
      requestStudentApplicationCallable({ campus, name, contactLast4 }),
      15000,
      "학생 신청 접수 시간이 초과되었습니다."
    );
    const data = response.data;
    event.currentTarget.reset();
    showApplicationResult(
      `${campusLabel(data.campus)} 학생 이용 신청이 접수되었습니다.\n\n` +
      `학생 이름: ${data.name}\n신청 확인번호: ${data.applicationCode}\n\n` +
      "마스터 또는 해당 관 승인 담당자가 확인한 뒤 학생코드와 임시 비밀번호를 별도로 전달합니다. " +
      "승인 전에는 학생 로그인창을 사용할 수 없습니다.",
      "success"
    );
    showStatus("학생 이용 신청이 정상 접수되었습니다.", "success");
  } catch (error) {
    const code = error.code ?? "확인 불가";
    const message = code.includes("already-exists")
      ? "이미 승인되었거나 처리된 신청입니다. 담당자에게 문의하세요."
      : error.message ?? String(error);
    showApplicationResult(`학생 신청에 실패했습니다.\n오류 코드: ${code}\n${message}`, "error");
    showStatus("학생 이용 신청을 접수하지 못했습니다.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "학생 이용 신청";
  }
}
