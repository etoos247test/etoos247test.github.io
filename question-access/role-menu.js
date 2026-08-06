import { canApproveStudents, isMaster } from "./shared.js";

const MENU_ID = "roleMenu";
let activeTeacherTab = "";

function ensureMenu() {
  let menu = document.getElementById(MENU_ID);
  if (menu) return menu;

  menu = document.createElement("section");
  menu.id = MENU_ID;
  menu.className = "role-dashboard hidden";
  document.getElementById("status")?.insertAdjacentElement("afterend", menu);

  const style = document.createElement("style");
  style.textContent = `
    .role-dashboard{margin-top:18px;padding:20px;border:1px solid #cbd5e1;border-radius:16px;background:linear-gradient(135deg,#f8fbff,#eef6ff)}
    .role-dashboard h2{margin:0;font-size:23px}.role-dashboard>p{margin:7px 0 0;color:#64748b;line-height:1.65}
    .cloud-separation{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .cloud-separation span{padding:7px 10px;border-radius:999px;background:#fff;color:#334155;font-size:12px;font-weight:850;border:1px solid #dbe3ed}
    .cloud-separation strong{color:#1d4ed8}
    .teacher-work-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;padding:8px;border:1px solid #cbd5e1;border-radius:15px;background:#fff}
    .teacher-work-tab{flex:1 1 145px;min-height:50px;border:1px solid #d7e0eb;border-radius:11px;background:#f8fafc;color:#334155;font-size:13px;font-weight:900;cursor:pointer}
    .teacher-work-tab:hover{border-color:#60a5fa;background:#eff6ff}.teacher-work-tab.active{border-color:#2563eb;background:#2563eb;color:#fff;box-shadow:0 7px 18px rgba(37,99,235,.2)}
    .teacher-work-summary{margin-top:12px;padding:12px 14px;border-radius:11px;background:#eaf2ff;color:#1e40af;font-size:13px;line-height:1.65;font-weight:750}
    .approval-permission-note{margin-top:14px;padding:16px;border:1px solid #fbbf24;border-radius:13px;background:#fffbeb;color:#92400e;line-height:1.7}
    .teacher-frame-wrap{margin-top:16px;border:1px solid #cbd5e1;border-radius:15px;background:#fff;overflow:hidden}
    .teacher-frame-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 15px;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#334155;font-size:13px;font-weight:850}
    .teacher-frame-head a{padding:7px 10px;border-radius:9px;background:#e2e8f0;color:#334155;font-size:12px}.teacher-work-frame{display:block;width:100%;height:780px;border:0;background:#eef3f9}
    .role-dashboard-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-top:16px}
    .role-dashboard-card{display:block;min-height:130px;padding:16px;border:1px solid #d5dfeb;border-radius:14px;background:#fff;color:#172033;box-shadow:0 6px 18px rgba(15,23,42,.04)}
    .role-dashboard-card:hover{transform:translateY(-2px);border-color:#60a5fa}.role-dashboard-card b{display:block;font-size:17px}.role-dashboard-card span{display:block;margin-top:8px;color:#64748b;font-size:12px;line-height:1.55}
    .role-dashboard-card.ready{border-color:#93c5fd;background:#eff6ff}.role-dashboard-card.disabled{opacity:.58;cursor:not-allowed}
    .role-common{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px;padding-top:14px;border-top:1px solid #dbe3ed}.role-common a{padding:8px 11px;border-radius:999px;background:#fff;color:#334155;font-size:12px;font-weight:850}
    .teacher-native-section-hidden{display:none!important}
    @media(max-width:900px){.role-dashboard-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.teacher-work-frame{height:840px}}
    @media(max-width:520px){.role-dashboard-grid{grid-template-columns:1fr}.teacher-work-tab{flex-basis:calc(50% - 8px)}.teacher-frame-head{align-items:flex-start;flex-direction:column}.teacher-work-frame{height:940px}}
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

function nativeTeacherParts() {
  const teacherPanel = document.getElementById("teacherPanel");
  return {
    teacherPanel,
    masterPanel: document.getElementById("masterPanel"),
    heading: teacherPanel?.querySelector(".panel-heading"),
    approval: document.getElementById("studentApprovalPanel"),
    directoryHead: teacherPanel?.querySelector(".directory-head"),
    directoryList: document.getElementById("studentDirectoryList"),
    questions: teacherPanel?.querySelector(".question-workspace")
  };
}

function setNativeVisibility(mode) {
  const parts = nativeTeacherParts();
  const approvalMode = mode === "approval";
  const questionMode = mode === "questions";
  const hasApproval = canApproveStudents() || isMaster();

  parts.teacherPanel?.classList.toggle("hidden", !(approvalMode || questionMode));
  parts.heading?.classList.toggle("teacher-native-section-hidden", approvalMode);
  parts.approval?.classList.toggle("hidden", !(approvalMode && hasApproval));
  parts.directoryHead?.classList.toggle("teacher-native-section-hidden", !questionMode);
  parts.directoryList?.classList.toggle("teacher-native-section-hidden", !questionMode);
  parts.questions?.classList.toggle("teacher-native-section-hidden", !questionMode);
  parts.masterPanel?.classList.toggle("hidden", !(approvalMode && isMaster()));

  document.getElementById("approvalPermissionNote")
    ?.classList.toggle("hidden", !(approvalMode && !hasApproval));
}

function tabInfo(tab) {
  const map = {
    approval: ["승인관리", "학생 가입 승인과 마스터의 교사 권한 승인을 처리합니다.", ""],
    notice: ["공지 입력", "학원 자체 공지를 등록·수정하고 학생 공개 여부를 관리합니다.", "../academy-board/?tab=notice"],
    schedule: ["시험일정 입력", "시험일, 기본 회차와 실제 시험명을 등록합니다.", "../academy-board/?tab=schedule"],
    score: ["성적 입력", "학생별 시험 성적을 개별 입력하고 누적 자료로 저장합니다.", "../teacher-score/"],
    counseling: ["상담 입력", "상담일 기준으로 목적·상담자·피상담자와 상담 내용을 기록합니다.", "../teacher-counseling/"],
    questions: ["질의응답", "승인 학생을 선택해 과목별 질문을 확인하고 답변합니다.", ""]
  };
  return map[tab] || map.approval;
}

function activateTeacherTab(tab) {
  activeTeacherTab = tab;
  const menu = ensureMenu();

  menu.querySelectorAll(".teacher-work-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.teacherTab === tab);
  });

  const [label, help, src] = tabInfo(tab);
  const summary = document.getElementById("teacherWorkSummary");
  if (summary) summary.textContent = `${label} · ${help}`;

  const frameWrap = document.getElementById("teacherFrameWrap");
  const frame = document.getElementById("teacherWorkFrame");
  const open = document.getElementById("teacherFrameOpen");

  if (src) {
    setNativeVisibility("external");
    frameWrap?.classList.remove("hidden");
    if (frame && frame.dataset.src !== src) {
      frame.src = src;
      frame.dataset.src = src;
    }
    if (open) open.href = src;
  } else {
    frameWrap?.classList.add("hidden");
    setNativeVisibility(tab);
  }
}

function bindTeacherTabs() {
  ensureMenu().querySelectorAll(".teacher-work-tab").forEach((button) => {
    button.addEventListener("click", () => activateTeacherTab(button.dataset.teacherTab));
  });
}

export function hideRoleMenu() {
  ensureMenu().classList.add("hidden");
  activeTeacherTab = "";
}

export function showTeacherRoleMenu() {
  const menu = ensureMenu();
  menu.innerHTML = `<h2>교사용 통합 업무화면</h2>
    <p>로그인과 동시에 승인 탭이 먼저 열리며, 상단 탭에서 각종 입력 업무로 바로 이동합니다.</p>
    <div class="cloud-separation">
      <span><strong>외부 화면·양식</strong> GitHub Pages 보관</span>
      <span><strong>학생·업무 데이터</strong> Firebase·Cloudflare 보관</span>
    </div>
    <nav class="teacher-work-tabs" aria-label="교사용 업무 탭">
      <button class="teacher-work-tab" type="button" data-teacher-tab="approval">승인관리</button>
      <button class="teacher-work-tab" type="button" data-teacher-tab="notice">공지입력</button>
      <button class="teacher-work-tab" type="button" data-teacher-tab="schedule">시험일정</button>
      <button class="teacher-work-tab" type="button" data-teacher-tab="score">성적입력</button>
      <button class="teacher-work-tab" type="button" data-teacher-tab="counseling">상담입력</button>
      <button class="teacher-work-tab" type="button" data-teacher-tab="questions">질의응답</button>
    </nav>
    <div id="teacherWorkSummary" class="teacher-work-summary"></div>
    <div id="approvalPermissionNote" class="approval-permission-note hidden">
      이 계정은 승인관리 탭을 볼 수 있지만 승인 권한은 없습니다. 마스터가 ‘학생 승인’ 또는 관련 관리 권한을 부여해야 실제 승인 처리가 가능합니다.
    </div>
    <div id="teacherFrameWrap" class="teacher-frame-wrap hidden">
      <div class="teacher-frame-head">
        <span>GitHub Pages 입력 화면 · 실제 데이터는 클라우드 저장</span>
        <a id="teacherFrameOpen" href="#" target="_blank" rel="noopener">새 창으로 열기 ↗</a>
      </div>
      <iframe id="teacherWorkFrame" class="teacher-work-frame" title="교사용 입력 화면"></iframe>
    </div>${commonLinks()}`;

  menu.classList.remove("hidden");
  bindTeacherTabs();
  queueMicrotask(() => activateTeacherTab("approval"));
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
