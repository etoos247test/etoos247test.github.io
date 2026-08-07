import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { auth } from "./firebase-client.js";

const API_BASE = "https://etoos247-qa-api.etoos247test.workers.dev";
const API_PREFIX = "/api/admin/annual-maintenance";

const state = {
  user: null,
  resetOperation: null,
  restoreOperation: null,
  backups: []
};

function injectStyles() {
  if (document.getElementById("annualMaintenanceStyles")) return;
  const style = document.createElement("style");
  style.id = "annualMaintenanceStyles";
  style.textContent = `
    .annual-maintenance { margin-top: 2.5rem; border-top: 2px solid #d8e0e8; padding-top: 2rem; }
    .annual-maintenance-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .maintenance-card { border: 1px solid #cfd9e3; border-radius: 18px; padding: 1.1rem; background: #f8fafc; }
    .maintenance-card.danger-zone { border-color: #f0b4b4; background: #fff8f8; }
    .maintenance-warning { padding: .85rem 1rem; border-radius: 12px; background: #fff2cc; color: #5e4300; font-weight: 700; line-height: 1.55; }
    .maintenance-field { display: grid; gap: .35rem; margin-top: .8rem; }
    .maintenance-field input, .maintenance-field select { width: 100%; }
    .maintenance-actions { display: flex; flex-wrap: wrap; gap: .55rem; margin-top: .9rem; }
    .maintenance-result { margin-top: .9rem; padding: .85rem; border-radius: 12px; background: #fff; border: 1px solid #d9e2ec; white-space: pre-wrap; line-height: 1.55; }
    .maintenance-code { display: grid; grid-template-columns: 1fr auto; gap: .5rem; align-items: center; margin-top: .7rem; }
    .maintenance-code code { display: block; padding: .65rem .8rem; background: #0b2035; color: #fff; border-radius: 10px; overflow-wrap: anywhere; }
    .maintenance-progress { height: 10px; border-radius: 999px; overflow: hidden; background: #dfe7ef; margin-top: .75rem; }
    .maintenance-progress > span { display: block; height: 100%; width: 0; background: #1f6feb; transition: width .2s ease; }
    .maintenance-small { font-size: .9rem; color: #52606d; line-height: 1.5; }
    @media (max-width: 850px) { .annual-maintenance-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);
}

function buildPanel() {
  const masterPanel = document.getElementById("masterAdminPanel");
  if (!masterPanel || document.getElementById("annualMaintenancePanel")) return;
  injectStyles();

  const wrapper = document.createElement("div");
  wrapper.id = "annualMaintenancePanel";
  wrapper.className = "annual-maintenance hidden";
  wrapper.innerHTML = `
    <div class="panel-head">
      <div>
        <p class="eyebrow dark">ANNUAL MAINTENANCE</p>
        <h2>학년도 백업·초기화</h2>
        <p>1단계 삭제 대상 확인, 2단계 확인문구·번호 검증과 암호화 백업을 거쳐야 초기화됩니다.</p>
      </div>
    </div>

    <div class="maintenance-warning">
      GitHub에는 개인정보가 포함된 원문을 저장하지 않고 AES-256-GCM으로 암호화한 백업만 저장합니다.
      첨부 사진은 비공개 R2 보관영역으로 복사하며 기본 보존기간은 90일입니다.
    </div>

    <div class="annual-maintenance-grid">
      <section class="maintenance-card danger-zone">
        <h3>연간 초기화</h3>
        <p class="maintenance-small">마스터 계정만 남기고 학생·교사·가입·승인·질문·답변·현재 사진 연결을 초기화합니다.</p>
        <label class="maintenance-field">새 학년도
          <input id="annualResetYear" inputmode="numeric" pattern="20[0-9]{2}" maxlength="4">
        </label>
        <div class="maintenance-actions">
          <button id="annualPrepareReset" class="button secondary" type="button">1단계 삭제 대상 확인</button>
        </div>
        <div id="annualResetPreview" class="maintenance-result">아직 확인하지 않았습니다.</div>
        <div id="annualResetConfirmArea" class="hidden">
          <div class="maintenance-code"><code id="annualResetPhrase"></code><button id="copyResetPhrase" class="button secondary small" type="button">문구 복사</button></div>
          <div class="maintenance-code"><code id="annualResetCode"></code><button id="copyResetCode" class="button secondary small" type="button">번호 복사</button></div>
          <label class="maintenance-field">확인 문구 다시 입력
            <input id="annualResetPhraseInput" autocomplete="off">
          </label>
          <label class="maintenance-field">6자리 확인번호
            <input id="annualResetCodeInput" inputmode="numeric" maxlength="6" autocomplete="off">
          </label>
          <div class="maintenance-actions">
            <button id="annualBackupReset" class="button primary" type="button">2단계 암호화 백업 실행</button>
            <button id="annualExecuteReset" class="button danger" type="button" disabled>백업 확인 후 초기화</button>
          </div>
          <div class="maintenance-progress"><span id="annualResetProgressBar"></span></div>
          <div id="annualResetProgressText" class="maintenance-result">백업 대기 중입니다.</div>
        </div>
      </section>

      <section class="maintenance-card">
        <h3>백업 목록·복원</h3>
        <p class="maintenance-small">GitHub 암호화 백업과 R2 보관 사진을 이용해 필요 시 이전 상태를 복원합니다. 현재 운영자료가 있으면 먼저 별도 백업을 완료하세요.</p>
        <div class="maintenance-actions">
          <button id="annualLoadBackups" class="button secondary" type="button">GitHub 백업 목록 불러오기</button>
        </div>
        <label class="maintenance-field">복원할 백업
          <select id="annualBackupSelect"><option value="">백업을 먼저 불러오세요</option></select>
        </label>
        <div class="maintenance-actions">
          <button id="annualPrepareRestore" class="button secondary" type="button">1단계 복원 내용 확인</button>
        </div>
        <div id="annualRestorePreview" class="maintenance-result">복원할 백업을 선택하지 않았습니다.</div>
        <div id="annualRestoreConfirmArea" class="hidden">
          <div class="maintenance-code"><code id="annualRestorePhrase"></code><button id="copyRestorePhrase" class="button secondary small" type="button">문구 복사</button></div>
          <div class="maintenance-code"><code id="annualRestoreCode"></code><button id="copyRestoreCode" class="button secondary small" type="button">번호 복사</button></div>
          <label class="maintenance-field">복원 확인 문구 다시 입력
            <input id="annualRestorePhraseInput" autocomplete="off">
          </label>
          <label class="maintenance-field">6자리 확인번호
            <input id="annualRestoreCodeInput" inputmode="numeric" maxlength="6" autocomplete="off">
          </label>
          <div class="maintenance-actions">
            <button id="annualExecuteRestore" class="button danger" type="button">2단계 백업 복원 실행</button>
          </div>
          <div class="maintenance-progress"><span id="annualRestoreProgressBar"></span></div>
          <div id="annualRestoreProgressText" class="maintenance-result">복원 대기 중입니다.</div>
        </div>
      </section>
    </div>
  `;
  masterPanel.appendChild(wrapper);

  const nextYear = new Date().getFullYear() + 1;
  document.getElementById("annualResetYear").value = String(nextYear);
  bindEvents();
}

function el(id) {
  return document.getElementById(id);
}

async function api(path, options = {}) {
  if (!state.user) throw new Error("먼저 마스터 계정으로 로그인하세요.");
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

function formatCounts(counts = {}) {
  const labels = {
    nonMasterUsers: "마스터 외 사용자",
    students: "승인 학생",
    teachers: "승인 교사",
    pendingUsers: "승인 대기 사용자",
    studentApplications: "학생 신청·승인 기록",
    teacherRequests: "교사 요청·승인 기록",
    questions: "질문",
    messages: "대화 메시지",
    attachments: "첨부 사진",
    auditLogs: "일반 감사기록",
    users: "사용자",
    teacher_campuses: "교사 소속관",
    student_applications: "학생 신청",
    teacher_requests: "교사 요청",
    audit_logs: "감사기록"
  };
  return Object.entries(counts)
    .map(([key, value]) => `${labels[key] || key}: ${Number(value || 0).toLocaleString("ko-KR")}건`)
    .join("\n");
}

function setProgress(barId, textId, current, total, message) {
  const ratio = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 100;
  el(barId).style.width = `${ratio}%`;
  el(textId).textContent = message;
}

function confirmValues(kind) {
  if (kind === "reset") {
    return {
      phrase: el("annualResetPhraseInput").value.trim(),
      code: el("annualResetCodeInput").value.trim()
    };
  }
  return {
    phrase: el("annualRestorePhraseInput").value.trim(),
    code: el("annualRestoreCodeInput").value.trim()
  };
}

async function copyText(value) {
  await navigator.clipboard.writeText(value);
}

async function prepareReset() {
  const academicYear = el("annualResetYear").value.trim();
  el("annualPrepareReset").disabled = true;
  try {
    const data = await api(`${API_PREFIX}/prepare-reset`, {
      method: "POST",
      json: { academicYear }
    });
    state.resetOperation = data;
    el("annualResetPreview").textContent = `삭제 예정 자료\n${formatCounts(data.counts)}\n\n확인 만료: ${new Date(data.expiresAt).toLocaleString("ko-KR")}`;
    el("annualResetPhrase").textContent = data.phrase;
    el("annualResetCode").textContent = data.code;
    el("annualResetConfirmArea").classList.remove("hidden");
    el("annualExecuteReset").disabled = true;
    setProgress("annualResetProgressBar", "annualResetProgressText", 0, 1, "확인 문구와 번호를 입력한 뒤 암호화 백업을 실행하세요.");
  } catch (error) {
    el("annualResetPreview").textContent = error.message;
  } finally {
    el("annualPrepareReset").disabled = false;
  }
}

async function backupReset() {
  if (!state.resetOperation) return;
  const button = el("annualBackupReset");
  button.disabled = true;
  el("annualExecuteReset").disabled = true;
  try {
    let result;
    do {
      result = await api(`${API_PREFIX}/backup-reset`, {
        method: "POST",
        json: {
          operationId: state.resetOperation.operationId,
          ...confirmValues("reset")
        }
      });
      const missing = result.missingObjects?.length || 0;
      setProgress(
        "annualResetProgressBar",
        "annualResetProgressText",
        result.copied,
        result.total,
        result.done
          ? `백업 완료\nGitHub: ${result.githubPath}\nR2 사진: ${result.copied}/${result.total}건\n누락 사진: ${missing}건`
          : `R2 사진 보관 중: ${result.copied}/${result.total}건`
      );
      if (!result.done) await new Promise((resolve) => setTimeout(resolve, 150));
    } while (!result.done);
    state.resetOperation = { ...state.resetOperation, ...result };
    el("annualExecuteReset").disabled = false;
  } catch (error) {
    el("annualResetProgressText").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function executeReset() {
  if (!state.resetOperation?.done && !state.resetOperation?.githubPath) return;
  const academicYear = state.resetOperation.academicYear;
  if (!confirm(`${academicYear}학년도 초기화를 실행합니다. 마스터 외 현재 운영자료는 삭제됩니다.`)) return;
  const button = el("annualExecuteReset");
  button.disabled = true;
  try {
    const result = await api(`${API_PREFIX}/execute-reset`, {
      method: "POST",
      json: {
        operationId: state.resetOperation.operationId,
        ...confirmValues("reset")
      }
    });
    el("annualResetProgressText").textContent = `초기화 완료\n백업: ${result.githubPath}\n완료 시각: ${new Date(result.completedAt).toLocaleString("ko-KR")}`;
    setProgress("annualResetProgressBar", "annualResetProgressText", 1, 1, el("annualResetProgressText").textContent);
    setTimeout(() => location.reload(), 1200);
  } catch (error) {
    el("annualResetProgressText").textContent = error.message;
    button.disabled = false;
  }
}

async function loadBackups() {
  const button = el("annualLoadBackups");
  button.disabled = true;
  try {
    const data = await api(`${API_PREFIX}/backups`);
    state.backups = data.backups || [];
    const select = el("annualBackupSelect");
    select.innerHTML = state.backups.length
      ? state.backups.map((backup) => `<option value="${backup.path}">${backup.academicYear} · ${backup.backupId}</option>`).join("")
      : '<option value="">등록된 GitHub 백업이 없습니다</option>';
    el("annualRestorePreview").textContent = `${state.backups.length}개의 암호화 백업을 불러왔습니다.`;
  } catch (error) {
    el("annualRestorePreview").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function prepareRestore() {
  const path = el("annualBackupSelect").value;
  if (!path) return;
  const button = el("annualPrepareRestore");
  button.disabled = true;
  try {
    const data = await api(`${API_PREFIX}/prepare-restore`, {
      method: "POST",
      json: { path }
    });
    state.restoreOperation = data;
    el("annualRestorePreview").textContent = `복원 대상: ${data.backupId}\n학년도: ${data.academicYear}\n${formatCounts(data.counts)}\n\n현재 운영자료는 덮어쓰므로 필요한 경우 먼저 현재 자료를 별도로 백업하세요.`;
    el("annualRestorePhrase").textContent = data.phrase;
    el("annualRestoreCode").textContent = data.code;
    el("annualRestoreConfirmArea").classList.remove("hidden");
    setProgress("annualRestoreProgressBar", "annualRestoreProgressText", 0, 1, "확인 문구와 번호를 입력한 뒤 복원을 실행하세요.");
  } catch (error) {
    el("annualRestorePreview").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function restoreProgressMessage(result) {
  if (result.phase === "delete_current_r2") return `현재 R2 사진 정리 중: ${result.deleteOffset}건`;
  if (result.phase === "copy_backup_r2") return `백업 사진 복원 중: ${result.copyOffset}/${result.copyTotal}건`;
  if (result.phase === "restore_d1") return `D1 데이터 복원 중: ${result.restoreTableIndex}/${result.restoreTableTotal}개 테이블`;
  if (result.done) return `복원 완료\n누락 사진: ${result.missingObjects?.length || 0}건\n완료 시각: ${new Date(result.completedAt).toLocaleString("ko-KR")}`;
  return "복원 처리 중입니다.";
}

async function executeRestore() {
  if (!state.restoreOperation) return;
  if (!confirm(`${state.restoreOperation.backupId} 백업으로 현재 운영자료를 교체합니다.`)) return;
  const button = el("annualExecuteRestore");
  button.disabled = true;
  try {
    let result;
    do {
      result = await api(`${API_PREFIX}/execute-restore`, {
        method: "POST",
        json: {
          operationId: state.restoreOperation.operationId,
          ...confirmValues("restore")
        }
      });
      let current = 0;
      let total = 1;
      if (result.phase === "copy_backup_r2") {
        current = result.copyOffset;
        total = Math.max(1, result.copyTotal);
      } else if (result.phase === "restore_d1") {
        current = result.restoreTableIndex;
        total = Math.max(1, result.restoreTableTotal);
      } else if (result.done) {
        current = 1;
      }
      setProgress("annualRestoreProgressBar", "annualRestoreProgressText", current, total, restoreProgressMessage(result));
      if (!result.done) await new Promise((resolve) => setTimeout(resolve, 150));
    } while (!result.done);
    setTimeout(() => location.reload(), 1500);
  } catch (error) {
    el("annualRestoreProgressText").textContent = error.message;
    button.disabled = false;
  }
}

function bindEvents() {
  el("annualPrepareReset").addEventListener("click", prepareReset);
  el("annualBackupReset").addEventListener("click", backupReset);
  el("annualExecuteReset").addEventListener("click", executeReset);
  el("annualLoadBackups").addEventListener("click", loadBackups);
  el("annualPrepareRestore").addEventListener("click", prepareRestore);
  el("annualExecuteRestore").addEventListener("click", executeRestore);
  el("copyResetPhrase").addEventListener("click", () => copyText(el("annualResetPhrase").textContent));
  el("copyResetCode").addEventListener("click", () => copyText(el("annualResetCode").textContent));
  el("copyRestorePhrase").addEventListener("click", () => copyText(el("annualRestorePhrase").textContent));
  el("copyRestoreCode").addEventListener("click", () => copyText(el("annualRestoreCode").textContent));
}

buildPanel();

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  const panel = el("annualMaintenancePanel");
  if (!panel) return;
  panel.classList.add("hidden");
  if (!user) return;
  try {
    const me = await api("/api/me");
    if (me.profile?.role === "master" && me.profile?.active === 1) {
      panel.classList.remove("hidden");
    }
  } catch (error) {
    console.error("연간 유지관리 권한 확인 실패", error);
  }
});
