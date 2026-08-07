import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAg6PnWUVfvlc10R81wb2liVxyGMbqbw78",
  authDomain: "etoos247test-10ffa.firebaseapp.com",
  projectId: "etoos247test-10ffa",
  storageBucket: "etoos247test-10ffa.firebasestorage.app",
  messagingSenderId: "795523938504",
  appId: "1:795523938504:web:1f5815dc67dd0906310dfd",
  measurementId: "G-NS4NCBBG4S"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const authPersistenceReady = setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error("Firebase 세션 유지 방식 설정 실패", error);
});
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
auth.languageCode = "ko";

// 질문 시스템은 Firebase Authentication만 사용한다.
// 사용자 권한·가입 승인·질문·대화는 Cloudflare D1에 저장한다.
// 학생과 교사의 질문 첨부 사진은 비공개 Cloudflare R2에 저장한다.

// 로그인 뒤 질문 화면을 전체 홈처럼 사용하지 않고 역할별 홈을 먼저 거친다.
// 실제 질문 업무를 선택한 경우에만 workspace=1로 질문 화면을 연다.
if (location.pathname.includes("/question-access/") &&
    new URLSearchParams(location.search).get("workspace") !== "1") {
  authPersistenceReady.then(() => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const response = await fetch("https://etoos247-qa-api.etoos247test.workers.dev/api/me", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        if (!response.ok) return;
        const me = await response.json();
        const profile = me.profile || {};
        if (profile.active !== 1) return;
        if (profile.role === "student") {
          location.replace("../student-home/");
        } else if (profile.role === "teacher" || profile.role === "master") {
          location.replace("../teacher-portal/");
        }
      } catch (error) {
        console.warn("역할별 홈 이동 확인 실패", error);
      }
    });
  });
}

// 학원 공지·시험일정 화면은 기존 Firestore와 Firebase Storage를 계속 사용한다.
export const db = getFirestore(app);
export const storage = getStorage(app);
