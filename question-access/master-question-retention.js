import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { auth } from "./firebase-client.js";

const API_BASE = "https://etoos247-qa-api.etoos247test.workers.dev";
const RETENTION_DAYS = 7;

const state = {
  user: null,
  questions: []
};

function el(id) {
  return document.getElementById(id);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function campusLabel(value) {
  return value === "suseong1" ? "수성1관" : value === "suseong2" ? "수성2관" : "미지정";
}

function statusLabel(value) {
  return {
    waiting_teacher: "교사 답변 대기",
    waiting_student: "학생 확인 대기",
    closed: "답변 완료·종료"
  }[value] || value || "상태 없음";
}

function autoDeleteAt(question) {
  if (question.status !== "closed" || !question.closed_at) return null;
  return new Date(new Date(question.closed_at).getTime() + RETENTION_DAYS * 86400000);
}

async function api(path, options = {}) {
  if (!state.user) throw new Error("마스터 로그인이 필요합니다.");
  const token = await state.user.getIdToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.json ? { "Content-Type": "application/json" } : {})
    },
    body: options.json ? JSON.stringify(options.json) : undefined,
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `API 오류 ${response.status}`);
  return data;
}

function injectStyles() {
  if (el("questionRetentionStyles")) return;
  const style = document.createElement("style");
  style.id = "questionRetentionStyles";
  style.textContent = `
    .question-retention { margin-top:2rem; padding-top:1.6rem; border-top:2px solid #d8e0e8; }
    .retention-toolbar { display:flex; gap:.6rem; flex-wrap:wrap; align-items:end; margin:1rem 0; }
    .retention-toolbar label { display:grid; gap:.35rem; min-width:180px; }
    .retention-list { display:grid; gap:.75rem; }
    .retention-card { padding:1rem; border:1px solid #d8e0e8; border-radius:14px; background:#fff; }
    .retention-card-head { display:flex; justify-content:space-between; gap:1rem; align-items:start; }
    .retention-card strong { display:block; }
    .retention-meta { margin-top:.45rem; color:#64748b; font-size:.9rem; line-height:1.55; }
    .retention-actions { display:flex; gap:.55rem; margin-top:.8rem; flex-wrap:wrap; }
    .retention-note { margin-top:.8rem; padding:.8rem 1rem; border-radius:12px; background:#fff7ed; color:#9a3412; line-height:1.55; }
  `;
  document.head.appendChild(style);
}

function buildPanel() {
  const host = el("masterAdminPanel");
  if (!host || el("masterQuestionRetentionPanel")) return;
  injectStyles();
  const section = document.createElement("section");
  section.id = "masterQuestionRetentionPanel";
  section.className = "question-retention hidden";
  section.innerHTML = `
    <div class="panel-head">
      <div>
        <p class="eyebrow dark">QUESTION RETENTION</p>
        <h2>질문 자동삭제·수시 삭제</h2>
        <p>답변 완료로 종료된 질문은 종료 시각부터 7일 뒤 자동 삭제됩니다. 마스터는 아래에서 즉시 삭제할 수 있습니다.</p>
      </div>
      <button id="reloadRetentionQuestions" class="button secondary" type="button">질문 다시 불러오기</button>
    </div>
    <div class="retention-note">질문을 삭제하면 D1의 질문·대화·사진 메타정보와 R2 원본 사진이 함께 삭제됩니다. 삭제 감사기록에는 질문 본문을 남기지 않습니다.</div>
    <div class="retention-toolbar">
      <label>상태
        <select id="retentionStatusFilter">
          <option value="all">전체</option>
          <option value="closed">답변 완료·종료</option>
          <option value="waiting_teacher">교사 답변 대기</option>
          <option value="waiting_student">학생 확인 대기</option>
        </select>
      </label>
      <label>학생 검색
        <input id="retentionSearch" type="search" placeholder="이름·학생번호·과목">
      </label>
    </div>
    <div id="retentionQuestionList" class="retention-list"></div>
  `;
  host.appendChild(section);

  el("reloadRetentionQuestions").addEventListener("click", loadQuestions);
  el("retentionStatusFilter").addEventListener("change", renderQuestions);
  el("retentionSearch").addEventListener("input", renderQuestions);
}

function visibleQuestions() {
  const status = el("retentionStatusFilter").value;
  const keyword = el("retentionSearch").value.trim().toLowerCase();
  return state.questions.filter((question) => {
    if (status !== "all" && question.status !== status) return false;
    if (!keyword) return true;
    return [question.student_name, question.student_id, question.subject, question.campus]
      .some((value) => String(value || "").toLowerCase().includes(keyword));
  });
}

function renderQuestions() {
  const container = el("retentionQuestionList");
  if (!container) return;
  const rows = visibleQuestions();
  container.innerHTML = "";
  if (!rows.length) {
    container.innerHTML = '<div class="empty">조건에 맞는 질문이 없습니다.</div>';
    return;
  }

  rows.forEach((question) => {
    const card = document.createElement("article");
    card.className = "retention-card";
    const deleteAt = autoDeleteAt(question);
    card.innerHTML = `
      <div class="retention-card-head">
        <div>
          <strong>${question.student_name || "학생"} · ${question.student_id || "-"} · ${question.subject || "과목"}</strong>
          <div class="retention-meta">
            ${campusLabel(question.campus)} · ${statusLabel(question.status)}<br>
            최근 대화 ${formatDate(question.last_message_at)}
            ${deleteAt ? `<br>자동삭제 예정 ${formatDate(deleteAt.toISOString())}` : ""}
          </div>
        </div>
      </div>
      <div class="retention-actions">
        <button class="button danger small" type="button">지금 삭제</button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", async () => {
      const label = `${question.student_name || "학생"} ${question.student_id || ""} ${question.subject || ""}`.trim();
      if (!confirm(`${label} 질문과 답변, 첨부사진을 모두 삭제할까요?`)) return;
      const reason = prompt("삭제 사유", "마스터 수시 삭제") ?? "마스터 수시 삭제";
      try {
        await api(`/api/admin/questions/${encodeURIComponent(question.id)}/delete`, {
          method: "POST",
          json: { reason }
        });
        await loadQuestions();
        const refresh = el("refreshBtn");
        if (refresh) refresh.click();
      } catch (error) {
        alert(error.message);
      }
    });
    container.appendChild(card);
  });
}

async function loadQuestions() {
  const button = el("reloadRetentionQuestions");
  if (button) button.disabled = true;
  try {
    const data = await api("/api/questions");
    state.questions = data.questions || [];
    renderQuestions();
  } catch (error) {
    const container = el("retentionQuestionList");
    if (container) container.innerHTML = `<div class="empty">${error.message}</div>`;
  } finally {
    if (button) button.disabled = false;
  }
}

buildPanel();

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  const panel = el("masterQuestionRetentionPanel");
  if (!panel) return;
  panel.classList.add("hidden");
  if (!user) return;
  try {
    const me = await api("/api/me");
    if (me.profile?.role === "master" && me.profile?.active === 1) {
      panel.classList.remove("hidden");
      await loadQuestions();
    }
  } catch (error) {
    console.error("질문 보존정책 화면을 열지 못했습니다.", error);
  }
});
