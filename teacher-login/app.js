import {
  onAuthStateChanged, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  auth, authPersistenceReady, db, provider
} from "../question-access/firebase-client.js";

const API_BASE = "https://etoos247-qa-api.etoos247test.workers.dev";
const loginButton = document.getElementById("teacherGoogleLogin");
const approvalState = document.getElementById("approvalState");
const status = document.getElementById("authStatus");
const requestActions = document.getElementById("requestActions");
const requestButton = document.getElementById("teacherRequestButton");
const failureActions = document.getElementById("failureActions");
const retryLogin = document.getElementById("retryLogin");

let redirecting = false;
let currentUser = null;

function setStatus(message, type = "") {
  status.className = `status ${type}`.trim();
  status.textContent = message;
}

function setApprovalState(label, code, type = "none") {
  approvalState.className = `approval-state ${type}`.trim();
  approvalState.classList.remove("hidden");
  approvalState.dataset.state = code;
  approvalState.querySelector("span").textContent = label;
}

function hideActions() {
  requestActions.classList.add("hidden");
  failureActions.classList.add("hidden");
}

async function api(user, path, options = {}) {
  const token = await user.getIdToken(options.forceToken === true);
  const headers = { Authorization: `Bearer ${token}` };
  let body;
  if (options.jsonBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.jsonBody);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body,
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `API 오류 ${response.status}`);
  return data;
}

function goToWorkspace(profile, user) {
  if (redirecting) return;
  redirecting = true;
  sessionStorage.setItem("etoos247AuthIntent", "staff");
  const roleLabel = profile.role === "master" ? "관리자" : "교사";
  setApprovalState("승인 완료", "approved", "approved");
  setStatus(
    `${user.displayName || roleLabel}님, 승인된 ${roleLabel} 계정입니다.\n교사용 업무 홈으로 이동합니다.`,
    "success"
  );
  window.setTimeout(() => location.replace("../teacher-portal/"), 700);
}

async function migrateLegacyRequest(user) {
  try {
    const legacySnap = await getDoc(doc(db, "teacherRequests", user.uid));
    if (!legacySnap.exists()) return null;
    const legacy = legacySnap.data() || {};
    if (String(legacy.status || "") !== "pending") return null;

    await api(user, "/api/teacher-requests", {
      method: "POST",
      jsonBody: { name: legacy.name || user.displayName || "교사" }
    });
    return true;
  } catch (error) {
    console.warn("기존 교사 승인 요청 자동 이관 생략", error);
    return null;
  }
}

function showRequestState(request) {
  const requestStatus = String(request?.status || "none");
  if (requestStatus === "pending") {
    setApprovalState("승인 대기 중", "pending", "pending");
    setStatus(
      "교사 권한 요청이 접수되었습니다. 관리자 화면의 교사 승인 대기 목록에서 확인할 수 있습니다.",
      "warning"
    );
    requestButton.textContent = "승인 대기 중";
    requestButton.disabled = true;
    requestActions.classList.remove("hidden");
    return;
  }
  if (requestStatus === "rejected") {
    setApprovalState("승인 요청 반려", "rejected", "rejected");
    setStatus(
      "승인 요청이 반려되었습니다. 사용한 Google 계정을 확인한 뒤 다시 요청해 주세요.",
      "error"
    );
    requestButton.textContent = "교사 권한 다시 요청";
    requestButton.disabled = false;
    requestActions.classList.remove("hidden");
    failureActions.classList.remove("hidden");
    return;
  }
  if (requestStatus === "approved") {
    setApprovalState("관리자 확인 필요", "approved", "pending");
    setStatus(
      "승인 기록은 확인되지만 활성 교사 권한이 아직 적용되지 않았습니다. 관리자에게 권한 설정을 확인해 주세요.",
      "warning"
    );
    failureActions.classList.remove("hidden");
    return;
  }

  setApprovalState("승인 요청 전", "none", "none");
  setStatus(
    "처음 이용하는 교사 계정입니다. 아래 버튼을 눌러 교사 권한을 요청해 주세요.",
    "warning"
  );
  requestButton.textContent = "교사 권한 승인 요청";
  requestButton.disabled = false;
  requestActions.classList.remove("hidden");
  failureActions.classList.remove("hidden");
}

async function verifyTeacher(user) {
  currentUser = user;
  loginButton.disabled = true;
  hideActions();
  setStatus("Google 계정을 확인했습니다. 교사 승인 상태를 확인하고 있습니다.");

  try {
    let me = await api(user, "/api/me");
    let profile = me.profile || null;
    let request = me.teacherRequest || null;
    const allowedRole = profile?.role === "teacher" || profile?.role === "master";

    if (profile?.active === 1 && allowedRole) {
      goToWorkspace(profile, user);
      return;
    }

    if (allowedRole && profile?.active !== 1) {
      setApprovalState("현재 이용 중지", "suspended", "suspended");
      setStatus(
        "승인된 계정이지만 현재 이용이 중지되어 있습니다. 관리자에게 이용 재개를 요청해 주세요.",
        "error"
      );
      failureActions.classList.remove("hidden");
      return;
    }

    if (!request) {
      const migrated = await migrateLegacyRequest(user);
      if (migrated) {
        setStatus("기존 승인 대기 요청을 새 관리 시스템으로 옮겼습니다. 상태를 다시 확인합니다.");
        me = await api(user, "/api/me", { forceToken: true });
        profile = me.profile || null;
        request = me.teacherRequest || null;
      }
    }

    showRequestState(request);
  } catch (error) {
    console.error(error);
    setApprovalState("상태 확인 실패", "error", "rejected");
    setStatus(
      "승인 상태를 확인하지 못했습니다. 잠시 후 다시 로그인하거나 관리자에게 문의해 주세요.",
      "error"
    );
    failureActions.classList.remove("hidden");
  } finally {
    if (!redirecting) loginButton.disabled = false;
  }
}

async function requestTeacherApproval() {
  if (!currentUser) {
    setStatus("먼저 Google 계정으로 로그인해 주세요.", "warning");
    return;
  }

  requestButton.disabled = true;
  setStatus("교사 권한 요청을 접수하고 있습니다.");

  try {
    await api(currentUser, "/api/teacher-requests", {
      method: "POST",
      jsonBody: { name: currentUser.displayName || "교사" }
    });
    const me = await api(currentUser, "/api/me", { forceToken: true });
    showRequestState(me.teacherRequest || { status: "pending" });
  } catch (error) {
    console.error(error);
    setStatus(
      "교사 권한 요청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "error"
    );
    requestButton.disabled = false;
  }
}

async function login() {
  loginButton.disabled = true;
  try {
    await authPersistenceReady;
    sessionStorage.setItem("etoos247AuthIntent", "staff");
    const result = await signInWithPopup(auth, provider);
    await verifyTeacher(result.user);
  } catch (error) {
    const message = error.code === "auth/popup-blocked"
      ? "로그인 창이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요."
      : error.code === "auth/popup-closed-by-user"
        ? "Google 로그인 창을 닫았습니다. 다시 로그인 버튼을 눌러 주세요."
        : "로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    setApprovalState("로그인 실패", "error", "rejected");
    setStatus(message, "error");
    failureActions.classList.remove("hidden");
    loginButton.disabled = false;
  }
}

async function useAnotherAccount() {
  redirecting = false;
  currentUser = null;
  await signOut(auth);
  approvalState.classList.add("hidden");
  hideActions();
  setStatus("사용할 Google 계정을 선택해 주세요.");
  await login();
}

loginButton.addEventListener("click", login);
requestButton.addEventListener("click", requestTeacherApproval);
retryLogin.addEventListener("click", useAnotherAccount);

await authPersistenceReady;
onAuthStateChanged(auth, (user) => {
  if (user && !redirecting) verifyTeacher(user);
});
