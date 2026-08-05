import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { db } from "./firebase-client.js";
import { $, campusLabel, els, state, showStatus, timeout } from "./shared.js";

function showApplicationResult(message, type = "success") {
  els.studentApplicationResult.className = `status ${type}`;
  els.studentApplicationResult.textContent = message;
}

export function showStudentApplicationPanel(user, application = null) {
  state.currentStudentApplication = application;
  els.studentApplicationPanel.classList.remove("hidden");
  els.studentApplicationAccount.textContent =
    `Google 계정: ${user.displayName ?? "이름 정보 없음"} · ${user.email ?? "이메일 정보 없음"}`;

  $("studentApplicationName").value = application?.name ?? user.displayName ?? "";
  $("studentApplicationCampus").value = application?.campus ?? "";
  $("studentApplicationContact").value = application?.contactLast4 ?? "";

  if (!application) {
    showApplicationResult("소속관과 학생정보를 입력한 뒤 가입 요청을 저장하세요.", "warning");
    return;
  }

  if (application.status === "pending") {
    showApplicationResult(
      `${campusLabel(application.campus)} 가입 요청이 승인 대기 중입니다.\n` +
      "정보를 수정해 다시 저장할 수 있습니다.",
      "warning"
    );
  } else if (application.status === "rejected") {
    showApplicationResult("이전 가입 요청이 반려되었습니다. 정보를 확인한 뒤 다시 신청하세요.", "error");
  } else if (application.status === "approved") {
    showApplicationResult("가입 요청은 승인됐지만 학생 권한 문서를 확인하지 못했습니다. 관리자에게 문의하세요.", "error");
  }
}

export async function submitStudentApplication(event) {
  event.preventDefault();

  if (!state.currentUser) {
    showApplicationResult("Google 로그인 후 가입을 신청할 수 있습니다.", "error");
    return;
  }

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
  button.textContent = "가입 요청 저장 중…";
  showStatus(`${campusLabel(campus)} 학생 가입 요청을 저장하는 중입니다.`);

  try {
    const application = {
      uid: state.currentUser.uid,
      name,
      email: state.currentUser.email ?? "",
      campus,
      contactLast4,
      status: "pending",
      requestedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await timeout(
      setDoc(doc(db, "studentApplications", state.currentUser.uid), application),
      12000,
      "학생 가입 요청 저장 시간이 초과되었습니다."
    );

    state.currentStudentApplication = { ...application, requestedAt: null, updatedAt: null };
    showApplicationResult(
      `${campusLabel(campus)} 학생 가입 요청이 저장되었습니다.\n\n` +
      `학생 이름: ${name}\nGoogle 계정: ${state.currentUser.email ?? ""}\n\n` +
      "마스터 또는 해당 관 승인 담당자가 내부 학생번호를 부여하면 같은 Google 계정으로 로그인할 수 있습니다.",
      "success"
    );
    showStatus("학생 가입 요청이 정상 저장되었습니다.", "success");
  } catch (error) {
    showApplicationResult(
      `학생 가입 요청 저장에 실패했습니다.\n오류 코드: ${error.code ?? "확인 불가"}\n${error.message ?? String(error)}`,
      "error"
    );
    showStatus("학생 가입 요청을 저장하지 못했습니다.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "가입 요청 저장";
  }
}
