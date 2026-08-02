(() => {
  "use strict";

  const DB_NAME = "etoos247-beta-qa";
  const DB_VERSION = 1;
  const STORE_NAME = "questions";
  const SESSION_KEY = "etoos247-beta-session-id";

  const toast = document.getElementById("toast");
  const qaForm = document.getElementById("qaForm");
  const qaText = document.getElementById("qaText");
  const qaSubmitButton = document.getElementById("qaSubmitBtn");
  const qaLoginButton = document.getElementById("qaLoginBtn");
  const myQuestionsButton = document.getElementById("qaMyQuestionsBtn");
  const authState = document.getElementById("authState");
  const statusNumbers = [...document.querySelectorAll(".qa-status-grid b")];

  let saving = false;
  let betaSessionId = "";

  try {
    betaSessionId = sessionStorage.getItem(SESSION_KEY) || "";
    if (!betaSessionId) {
      betaSessionId = `beta-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, betaSessionId);
    }
  } catch {
    betaSessionId = `beta-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const betaUser = Object.freeze({
    uid: betaSessionId,
    displayName: "베타 사용자",
    email: "",
    isAnonymous: true,
    beta: true
  });

  function showToast(message, type = "") {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`.trim();
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.className = "toast";
    }, 5200);
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("이 브라우저는 베타 로컬 저장을 지원하지 않습니다."));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("createdAt", "createdAt");
          store.createIndex("status", "status");
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("베타 저장소를 열지 못했습니다."));
      request.onblocked = () => reject(new Error("다른 탭을 닫고 다시 시도해 주세요."));
    });
  }

  async function saveQuestion(record) {
    const db = await openDatabase();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("질문 저장에 실패했습니다."));
        transaction.onabort = () => reject(transaction.error || new Error("질문 저장이 중단되었습니다."));
      });
    } finally {
      db.close();
    }
  }

  async function readAllQuestions() {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => reject(request.error || new Error("저장된 질문을 읽지 못했습니다."));
      });
    } finally {
      db.close();
    }
  }

  function makeId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return `q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function applyBetaUI() {
    if (authState) authState.textContent = "베타 운영";

    const guide = document.querySelector(".qa-login-guide");
    const guideTitle = guide?.querySelector("strong");
    const guideText = guide?.querySelector("span");
    if (guideTitle) guideTitle.textContent = "베타 기간에는 로그인 없이 등록됩니다.";
    if (guideText) guideText.textContent = "질문은 현재 사용 중인 기기와 브라우저에만 임시 저장됩니다.";

    if (qaLoginButton) qaLoginButton.textContent = "Google 로그인(정식 운영 예정)";
    if (qaSubmitButton) qaSubmitButton.innerHTML = "베타 질문 저장하기 <span>→</span>";

    const privacyText = document.querySelector(".qa-privacy-card p");
    if (privacyText) {
      privacyText.textContent = "베타 질문과 사진은 외부 서버로 전송되지 않고 이 기기의 브라우저 저장소에만 보관됩니다. 브라우저 데이터를 삭제하면 함께 사라집니다.";
    }

    document.querySelectorAll(
      "#googleLoginBtn,#heroLoginBtn,#sectionLoginBtn,#programLoginBtn,#mobileLoginBtn,#qaLoginBtn"
    ).forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        showToast("베타 기간에는 로그인 없이 질문을 저장할 수 있습니다.");
      }, { capture: true });
    });
  }

  async function refreshStatus() {
    try {
      const questions = await readAllQuestions();
      const waiting = questions.filter(item => item.status === "waiting").length;
      const checking = questions.filter(item => item.status === "checking").length;
      const complete = questions.filter(item => item.status === "complete").length;
      if (statusNumbers[0]) statusNumbers[0].textContent = String(waiting);
      if (statusNumbers[1]) statusNumbers[1].textContent = String(checking);
      if (statusNumbers[2]) statusNumbers[2].textContent = String(complete);

      const statusLabel = document.querySelector(".qa-status-card > div:first-child strong");
      if (statusLabel) statusLabel.textContent = `이 기기 저장 ${questions.length}건`;
      return questions;
    } catch {
      return [];
    }
  }

  async function handleBetaSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (saving) return;
    if (document.getElementById("qaDropzone")?.classList.contains("processing")) {
      showToast("사진 처리가 끝난 뒤 저장해 주세요.");
      return;
    }

    const question = qaText?.value.trim() || "";
    if (!question) {
      qaText?.focus();
      showToast("질문 내용을 입력해 주세요.", "error");
      return;
    }

    const attachment = window.etoosQaAttachment?.getFile?.() || null;
    if (attachment && attachment.size > 1024 * 1024) {
      showToast("첨부 사진이 1MB를 초과해 저장할 수 없습니다.", "error");
      return;
    }

    saving = true;
    if (qaSubmitButton) qaSubmitButton.disabled = true;

    try {
      const subject = document.querySelector('input[name="qaSubject"]:checked')?.value || "기타";
      const record = {
        id: makeId(),
        sessionId: betaSessionId,
        subject,
        question,
        status: "waiting",
        createdAt: new Date().toISOString(),
        photo: attachment || null,
        photoName: attachment?.name || "",
        photoType: attachment?.type || "",
        photoSize: attachment?.size || 0
      };

      await saveQuestion(record);
      qaForm?.reset();
      if (qaText) qaText.value = "";
      const charCount = document.getElementById("qaCharCount");
      if (charCount) charCount.textContent = "0";
      window.etoosQaAttachment?.clear?.();
      await refreshStatus();
      showToast("베타 질문을 이 기기 브라우저에 저장했습니다.", "success");
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "베타 질문 저장에 실패했습니다.", "error");
    } finally {
      saving = false;
      if (qaSubmitButton) qaSubmitButton.disabled = false;
    }
  }

  async function handleMyQuestions(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const questions = await refreshStatus();
    if (!questions.length) {
      showToast("이 기기에 저장된 베타 질문이 없습니다.");
      return;
    }
    const latest = [...questions].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    showToast(`이 기기에 ${questions.length}개의 베타 질문이 있습니다. 최근 질문: ${latest.subject} · ${latest.question.slice(0, 30)}`);
  }

  applyBetaUI();

  window.etoosAuth = {
    auth: { currentUser: betaUser },
    realAuth: null,
    betaQaNoLogin: true,
    betaUser,
    isActuallyLoggedIn: () => false
  };

  qaForm?.addEventListener("submit", handleBetaSubmit, { capture: true });
  myQuestionsButton?.addEventListener("click", handleMyQuestions, { capture: true });
  refreshStatus();
})();

import("./demo-plan.js").catch(error => {
  console.error("시연 운영 계획을 불러오지 못했습니다.", error);
});