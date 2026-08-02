import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  browserSessionPersistence,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig, appSettings } from "./firebase-config.js";

// 베타 운영 중에는 1:1 질문 등록만 로그인 없이 허용한다.
// 상단 로그인·승인 화면과 실제 Firebase 인증 기능은 그대로 유지한다.
const BETA_QA_NO_LOGIN = true;
const betaSessionKey = "etoos247-beta-session-id";
let betaSessionId = "";

try {
  betaSessionId = sessionStorage.getItem(betaSessionKey) || "";
  if (!betaSessionId) {
    betaSessionId = `beta-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(betaSessionKey, betaSessionId);
  }
} catch {
  betaSessionId = `beta-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const betaUser = Object.freeze({
  uid: betaSessionId,
  displayName: "베타 사용자",
  email: "",
  photoURL: "",
  isAnonymous: true,
  beta: true
});

const isConfigured = Boolean(
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith("YOUR_") &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.startsWith("YOUR_")
);

const toast = document.getElementById("toast");
const loginButtons = [
  "googleLoginBtn", "heroLoginBtn", "sectionLoginBtn",
  "programLoginBtn", "mobileLoginBtn", "qaLoginBtn"
].map(id => document.getElementById(id)).filter(Boolean);

const profileButton = document.getElementById("profileButton");
const profileMenu = document.getElementById("profileMenu");
const profileImage = document.getElementById("profileImage");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileRole = document.getElementById("profileRole");
const logoutButton = document.getElementById("logoutBtn");
const authState = document.getElementById("authState");

function showToast(message, type = "") {
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`.trim();
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.className = "toast";
  }, 4200);
}

function applyBetaQaUI() {
  if (!BETA_QA_NO_LOGIN) return;

  const guide = document.querySelector(".qa-login-guide");
  const guideTitle = guide?.querySelector("strong");
  const guideText = guide?.querySelector("span");
  const qaLoginButton = document.getElementById("qaLoginBtn");
  const qaSubmitButton = document.getElementById("qaSubmitBtn");

  if (guideTitle) guideTitle.textContent = "베타 기간에는 로그인 없이 등록됩니다.";
  if (guideText) guideText.textContent = "정식 운영 전 테스트를 위해 로그인 절차를 잠시 생략합니다.";
  if (qaLoginButton) qaLoginButton.textContent = "Google 로그인(선택)";
  if (qaSubmitButton) qaSubmitButton.innerHTML = "베타 질문 등록하기 <span>→</span>";
}

function createAuthView(realAuth = null) {
  if (!realAuth) {
    return {
      currentUser: BETA_QA_NO_LOGIN ? betaUser : null
    };
  }

  return new Proxy(realAuth, {
    get(target, property) {
      if (property === "currentUser" && BETA_QA_NO_LOGIN) {
        return target.currentUser || betaUser;
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function exposeAuth(realAuth = null, extras = {}) {
  window.etoosAuth = {
    ...extras,
    auth: createAuthView(realAuth),
    realAuth,
    betaQaNoLogin: BETA_QA_NO_LOGIN,
    betaUser,
    isActuallyLoggedIn: () => Boolean(realAuth?.currentUser)
  };
}

function setLoggedOutUI() {
  loginButtons.forEach(button => button.classList.remove("hidden"));
  profileButton?.classList.add("hidden");
  profileMenu?.classList.add("hidden");
  if (authState) authState.textContent = "로그인 전";
}

function setLoggedInUI(user, access) {
  loginButtons.forEach(button => button.classList.add("hidden"));
  profileButton?.classList.remove("hidden");
  if (profileImage) {
    profileImage.src = user.photoURL || "";
    profileImage.alt = `${user.displayName || "사용자"} 프로필`;
  }
  if (profileName) profileName.textContent = user.displayName || "사용자";
  if (profileEmail) profileEmail.textContent = user.email || "";
  if (profileRole) {
    profileRole.textContent = access.active
      ? `승인 완료 · ${access.role || "member"}`
      : "승인 대기";
  }
  if (authState) authState.textContent = access.active ? "승인 계정" : "승인 대기";
}

applyBetaQaUI();

if (!isConfigured) {
  loginButtons.forEach(button => button.addEventListener("click", () => {
    showToast("Firebase 설정값을 먼저 입력해 주세요. README_SETUP.md를 확인하세요.", "error");
  }));
  setLoggedOutUI();
  exposeAuth(null, {
    loginWithGoogle: async () => showToast("현재 베타 질문 등록은 로그인 없이 사용할 수 있습니다."),
    signOut: async () => {}
  });
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
    hd: ""
  });

  async function ensureSessionPersistence() {
    if (appSettings.sessionOnly) {
      await setPersistence(auth, browserSessionPersistence);
    }
  }

  async function submitAccessRequest(user) {
    const requestRef = doc(db, "accessRequests", user.uid);
    const requestSnapshot = await getDoc(requestRef);

    if (!requestSnapshot.exists()) {
      await setDoc(requestRef, {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        status: "pending",
        requestedAt: serverTimestamp()
      });
    }
  }

  async function getAccess(user) {
    const userSnapshot = await getDoc(doc(db, "users", user.uid));
    if (!userSnapshot.exists()) {
      await submitAccessRequest(user);
      return { active: false, role: "pending" };
    }

    const data = userSnapshot.data();
    return {
      active: data.active === true,
      role: data.role || "member"
    };
  }

  async function loginWithGoogle() {
    try {
      await ensureSessionPersistence();
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (
        error.code === "auth/popup-blocked" ||
        error.code === "auth/cancelled-popup-request" ||
        error.code === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      if (error.code !== "auth/popup-closed-by-user") {
        console.error(error);
        showToast(`로그인에 실패했습니다: ${error.code || "알 수 없는 오류"}`, "error");
      }
    }
  }

  loginButtons.forEach(button => button.addEventListener("click", loginWithGoogle));

  profileButton?.addEventListener("click", () => {
    const expanded = profileButton.getAttribute("aria-expanded") === "true";
    profileButton.setAttribute("aria-expanded", String(!expanded));
    profileMenu?.classList.toggle("hidden", expanded);
  });

  logoutButton?.addEventListener("click", async () => {
    await signOut(auth);
    showToast("로그아웃했습니다.", "success");
  });

  try {
    await ensureSessionPersistence();
    await getRedirectResult(auth);
  } catch (error) {
    console.error(error);
    showToast(`로그인 처리 중 오류가 발생했습니다: ${error.code || "unknown"}`, "error");
  }

  onAuthStateChanged(auth, async user => {
    if (!user) {
      setLoggedOutUI();
      return;
    }

    try {
      const access = await getAccess(user);
      setLoggedInUI(user, access);

      if (access.active) {
        showToast(`${user.displayName || "사용자"}님, 로그인했습니다.`, "success");
        if (new URLSearchParams(location.search).get("next") === "dashboard") {
          location.href = appSettings.dashboardUrl;
        }
      } else {
        showToast("로그인 요청이 등록되었습니다. 관리자 승인 후 전용 화면을 사용할 수 있습니다.");
      }
    } catch (error) {
      console.error(error);
      setLoggedInUI(user, { active: false, role: "error" });
      showToast("계정 승인 상태를 확인하지 못했습니다. Firestore 규칙을 확인하세요.", "error");
    }
  });

  exposeAuth(auth, {
    db,
    loginWithGoogle,
    signOut: () => signOut(auth)
  });
}
