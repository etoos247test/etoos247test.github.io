import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  browserSessionPersistence,
  setPersistence,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
const loading = document.getElementById("loadingPanel");
const denied = document.getElementById("deniedPanel");
const dashboard = document.getElementById("dashboard");

function showDenied() {
  loading?.classList.add("hidden");
  dashboard?.classList.add("hidden");
  denied?.classList.remove("hidden");
}

if (!configured) {
  showDenied();
  denied.querySelector("h1").textContent = "Firebase 설정이 필요합니다.";
  denied.querySelector("p").textContent = "assets/js/firebase-config.js에 Firebase 웹 앱 설정값을 입력하세요.";
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await setPersistence(auth, browserSessionPersistence);

  document.getElementById("dashboardLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    location.href = "../";
  });

  onAuthStateChanged(auth, async user => {
    if (!user) {
      location.replace("../?next=dashboard");
      return;
    }

    try {
      const snapshot = await getDoc(doc(db, "users", user.uid));
      const access = snapshot.exists() ? snapshot.data() : null;

      if (!access || access.active !== true) {
        showDenied();
        return;
      }

      loading?.classList.add("hidden");
      denied?.classList.add("hidden");
      dashboard?.classList.remove("hidden");

      document.getElementById("dashboardName").textContent = user.displayName || "사용자";
      document.getElementById("dashboardEmail").textContent = user.email || "";
      document.getElementById("dashboardRole").textContent = access.role || "member";

      const photo = document.getElementById("dashboardPhoto");
      photo.src = user.photoURL || "";
      photo.alt = `${user.displayName || "사용자"} 프로필`;

      if (access.role === "admin" || access.role === "staff") {
        document.querySelectorAll(".admin-only").forEach(item => item.classList.remove("hidden"));
      }
    } catch (error) {
      console.error(error);
      showDenied();
      denied.querySelector("h1").textContent = "권한을 확인하지 못했습니다.";
      denied.querySelector("p").textContent = "Firestore 보안 규칙과 사용자 승인 문서를 확인하세요.";
    }
  });
}
