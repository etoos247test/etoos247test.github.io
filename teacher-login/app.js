import {
  onAuthStateChanged, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc, getDoc, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  auth, authPersistenceReady, db, provider
} from "../question-access/firebase-client.js";

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
  approvalState.querySelector("span").textContent = `${label} (${code})`;
}

function hideActions() {
  requestActions.classList.add("hidden");
  failureActions.classList.add("hidden");
}

function goToWorkspace(profile, user) {
  if (redirecting) return;
  redirecting = true;
  sessionStorage.setItem("etoos247AuthIntent", "staff");
  const canApprove = profile.role === "master" || profile.canApproveStudents === true;
  sessionStorage.setItem("etoos247TeacherStartTab", canApprove ? "approval" : "notice");
  const roleLabel = profile.role === "master" ? "마스터" : "교사";
  setApprovalState("승인 완료", "approved", "approved");
  setStatus(
    `${user.displayName || roleLabel}님\n교사 승인 완료 · 권한: ${roleLabel}\n교사용 업무화면으로 이동합니다.`,
    "success"
  );
  window.setTimeout(() => location.replace("../question-access/?role=teacher"), 900);
}

async function verifyTeacher(user) {
  currentUser = user;
  loginButton.disabled = true;
  hideActions();
  setStatus("Google 계정 확인 완료. 교사 승인 상태를 확인하고 있습니다.");

  try {
    const [profileSnap, requestSnap] = await Promise.all([
      getDoc(doc(db, "users", user.uid)),
      getDoc(doc(db, "teacherRequests", user.uid))
    ]);
    const profile = profileSnap.exists() ? profileSnap.data() : null;
    const request = requestSnap.exists() ? requestSnap.data() : null;
    const allowedRole = profile?.role === "teacher" || profile?.role === "master";

    if (profile?.active === true && allowedRole) {
      goToWorkspace(profile, user);
      return;
    }

    if (allowedRole && profile?.active !== true) {
      setApprovalState("승인 완료 · 이용 중지", "approved/suspended", "suspended");
      setStatus(
        "교사 승인은 완료되었지만 현재 계정 이용이 중지되어 있습니다. 마스터 관리자에게 이용 재개를 요청하세요.",
        "error"
      );
      failureActions.classList.remove("hidden");
      return;
    }

    const requestStatus = String(request?.status || "none");
    if (requestStatus === "pending") {
      setApprovalState("승인 대기", "pending", "pending");
      setStatus(
        "교사 승인 요청이 접수되었습니다. 마스터가 관리 지점과 권한을 지정할 때까지 기다려 주세요.",
        "warning"
      );
      requestButton.textContent = "승인 대기 중";
      requestButton.disabled = true;
      requestActions.classList.remove("hidden");
    } else if (requestStatus === "rejected") {
      setApprovalState("승인 반려", "rejected", "rejected");
      setStatus(
        "교사 승인 요청이 반려되었습니다. 계정을 확인한 뒤 다시 승인 요청을 보낼 수 있습니다.",
        "error"
      );
      requestButton.textContent = "교사 권한 다시 요청";
      requestButton.disabled = false;
      requestActions.classList.remove("hidden");
      failureActions.classList.remove("hidden");
    } else if (requestStatus === "approved") {
      setApprovalState("승인 완료 · 권한 반영 확인 필요", "approved", "pending");
      setStatus(
        "교사 승인 기록은 있으나 활성 교사 권한 문서가 확인되지 않습니다. 마스터 관리자에게 권한 반영을 요청하세요.",
        "warning"
      );
      failureActions.classList.remove("hidden");
    } else {
      setApprovalState("승인 요청 전", "none", "none");
      setStatus(
        "이 Google 계정은 아직 교사 승인 요청을 하지 않았습니다. 아래 버튼으로 승인 요청을 저장하세요.",
        "warning"
      );
      requestButton.textContent = "교사 권한 승인 요청";
      requestButton.disabled = false;
      requestActions.classList.remove("hidden");
      failureActions.classList.remove("hidden");
    }
  } catch (error) {
    console.error(error);
    setApprovalState("상태 확인 실패", "error", "rejected");
    setStatus(
      `교사 승인 상태를 확인하지 못했습니다.\n${error.message || String(error)}`,
      "error"
    );
    failureActions.classList.remove("hidden");
  } finally {
    if (!redirecting) loginButton.disabled = false;
  }
}

async function requestTeacherApproval() {
  if (!currentUser) {
    setStatus("먼저 Google 계정으로 로그인하세요.", "warning");
    return;
  }

  requestButton.disabled = true;
  setStatus("교사 승인 요청을 저장하는 중입니다.");

  try {
    await setDoc(doc(db, "teacherRequests", currentUser.uid), {
      uid: currentUser.uid,
      name: currentUser.displayName || "",
      email: currentUser.email || "",
      status: "pending",
      requestedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    setApprovalState("승인 대기", "pending", "pending");
    setStatus("교사 승인 요청이 접수되었습니다. 마스터 승인을 기다려 주세요.", "success");
    requestButton.textContent = "승인 대기 중";
    requestButton.disabled = true;
    failureActions.classList.remove("hidden");
  } catch (error) {
    setStatus(
      `교사 승인 요청을 저장하지 못했습니다.\n${error.message || String(error)}`,
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
      ? "로그인 팝업이 차단되었습니다. 브라우저에서 팝업을 허용하세요."
      : error.code === "auth/popup-closed-by-user"
        ? "Google 로그인 창을 닫았습니다. 다시 인증 버튼을 누르세요."
        : error.message || String(error);
    setApprovalState("인증 실패", "error", "rejected");
    setStatus(`Google 인증에 실패했습니다.\n${message}`, "error");
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
  setStatus("다른 Google 계정으로 로그인하세요.");
  await login();
}

loginButton.addEventListener("click", login);
requestButton.addEventListener("click", requestTeacherApproval);
retryLogin.addEventListener("click", useAnotherAccount);

await authPersistenceReady;
onAuthStateChanged(auth, (user) => {
  if (user && !redirecting) verifyTeacher(user);
});
