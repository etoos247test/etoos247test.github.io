const MENU_ID = "roleMenu";

function ensureMenu() {
  let menu = document.getElementById(MENU_ID);
  if (menu) return menu;
  menu = document.createElement("section");
  menu.id = MENU_ID;
  menu.className = "role-dashboard hidden";
  const status = document.getElementById("status");
  status?.insertAdjacentElement("afterend", menu);

  const style = document.createElement("style");
  style.textContent = `
    .role-dashboard{margin-top:18px;padding:20px;border:1px solid #cbd5e1;border-radius:16px;background:linear-gradient(135deg,#f8fbff,#eef6ff)}
    .role-dashboard h2{margin:0;font-size:23px}.role-dashboard>p{margin:7px 0 0;color:#64748b;line-height:1.65}
    .role-dashboard-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-top:16px}
    .role-dashboard-card{display:block;min-height:130px;padding:16px;border:1px solid #d5dfeb;border-radius:14px;background:#fff;color:#172033;box-shadow:0 6px 18px rgba(15,23,42,.04)}
    .role-dashboard-card:hover{transform:translateY(-2px);border-color:#60a5fa}.role-dashboard-card b{display:block;font-size:17px}.role-dashboard-card span{display:block;margin-top:8px;color:#64748b;font-size:12px;line-height:1.55}
    .role-dashboard-card.ready{border-color:#93c5fd;background:#eff6ff}.role-dashboard-card.disabled{opacity:.58;cursor:not-allowed}
    .role-common{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px;padding-top:14px;border-top:1px solid #dbe3ed}.role-common a{padding:8px 11px;border-radius:999px;background:#fff;color:#334155;font-size:12px;font-weight:850}
    @media(max-width:900px){.role-dashboard-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.role-dashboard-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  return menu;
}

function commonLinks() {
  return `<div class="role-common" aria-label="공통 외부 링크">
    <a href="https://ipsywan.com/" target="_blank" rel="noopener noreferrer">입시의 완 ↗</a>
    <a href="https://daegu247.etoos.com/main.do" target="_blank" rel="noopener noreferrer">수성1관 홈페이지 ↗</a>
    <a href="https://suseong247.etoos.com/main.do" target="_blank" rel="noopener noreferrer">수성2관 홈페이지 ↗</a>
  </div>`;
}

export function hideRoleMenu() {
  ensureMenu().classList.add("hidden");
}

export function showTeacherRoleMenu() {
  const menu = ensureMenu();
  menu.innerHTML = `<h2>교사용 업무 메뉴</h2><p>교사 권한으로 사용할 기능을 선택하세요.</p>
    <div class="role-dashboard-grid">
      <a class="role-dashboard-card ready" href="#teacherPanel"><b>질의응답</b><span>학생 질문 확인과 답변 등록</span></a>
      <a class="role-dashboard-card ready" href="../academy-board/?tab=notice"><b>공지·시험일정 입력</b><span>학원 자체 공지와 시험일정 등록·수정</span></a>
      <div class="role-dashboard-card disabled"><b>성적 입력</b><span>개별 입력과 엑셀·CSV 일괄 입력 준비 중</span></div>
      <div class="role-dashboard-card disabled"><b>상담 입력</b><span>상담일 기준 상담기록 입력 기능 준비 중</span></div>
    </div>${commonLinks()}`;
  menu.classList.remove("hidden");
}

export function showStudentRoleMenu() {
  const menu = ensureMenu();
  menu.innerHTML = `<h2>학생 개인 메뉴</h2><p>본인에게 허용된 자료만 확인할 수 있습니다.</p>
    <div class="role-dashboard-grid">
      <a class="role-dashboard-card ready" href="#studentPanel"><b>질의응답</b><span>질문 등록과 내 답변 확인</span></a>
      <a class="role-dashboard-card ready" href="../academy-board/?tab=notice"><b>학원공지</b><span>소속관과 전체 공지 열람</span></a>
      <a class="role-dashboard-card ready" href="../academy-board/?tab=schedule"><b>시험일정</b><span>공개된 시험일정 날짜순 확인</span></a>
      <div class="role-dashboard-card disabled"><b>상담내역·성적내역</b><span>개인 자료 연동 준비 중</span></div>
    </div>${commonLinks()}`;
  menu.classList.remove("hidden");
}

export function replaceSharedLinks() {
  const nav = document.querySelector(".shared-links");
  if (!nav) return;
  nav.innerHTML = `<a href="https://ipsywan.com/" target="_blank" rel="noopener noreferrer">입시의 완 ↗</a>
    <a href="https://daegu247.etoos.com/main.do" target="_blank" rel="noopener noreferrer">수성1관 홈페이지 ↗</a>
    <a href="https://suseong247.etoos.com/main.do" target="_blank" rel="noopener noreferrer">수성2관 홈페이지 ↗</a>`;
}
