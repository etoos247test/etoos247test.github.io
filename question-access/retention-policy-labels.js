function applyPolicyLabels() {
  const panel = document.getElementById("annualMaintenancePanel");
  if (!panel) return false;

  const warning = panel.querySelector(".maintenance-warning");
  if (warning) {
    warning.textContent = "GitHub에는 개인정보가 포함된 원문을 저장하지 않고 AES-256-GCM으로 암호화한 백업만 저장합니다. 첨부 사진은 비공개 R2 보관영역으로 복사하며 보존기간은 30일입니다.";
  }

  const cards = panel.querySelectorAll(".maintenance-card");
  if (cards[0]) {
    const description = cards[0].querySelector(".maintenance-small");
    if (description) {
      description.textContent = "마스터와 현재 승인 교사의 로그인·권한·소속관 정보는 유지합니다. 학생·승인 대기·질문·답변·현재 질문 사진 연결만 초기화합니다.";
    }

    if (!document.getElementById("preservedTeacherPolicyNote")) {
      const note = document.createElement("div");
      note.id = "preservedTeacherPolicyNote";
      note.className = "maintenance-result";
      note.textContent = "초기화 제외: 마스터 계정, 현재 승인 교사 계정, 교사 소속관과 권한\n초기화 대상: 학생, 학생 신청, 미승인 교사 요청, 질문·답변, 질문 첨부사진";
      const preview = document.getElementById("annualResetPreview");
      preview?.insertAdjacentElement("afterend", note);
    }
  }

  if (cards[1]) {
    const description = cards[1].querySelector(".maintenance-small");
    if (description) {
      description.textContent = "GitHub 암호화 백업과 30일 동안 보관되는 R2 사진 사본을 이용해 복원합니다. 30일이 지난 사진 사본은 자동 삭제되므로 그 이후에는 D1 글 자료만 복원될 수 있습니다.";
    }
  }

  return true;
}

if (!applyPolicyLabels()) {
  const observer = new MutationObserver(() => {
    if (applyPolicyLabels()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
