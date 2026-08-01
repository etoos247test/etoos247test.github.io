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

if (!isConfigured) {
  loginButtons.forEach(button => button.addEventListener("click", () => {
    showToast("Firebase 설정값을 먼저 입력해 주세요. README_SETUP.md를 확인하세요.", "error");
  }));
  setLoggedOutUI();
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

  window.etoosAuth = { auth, db, loginWithGoogle, signOut: () => signOut(auth) };
}
