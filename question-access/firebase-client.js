import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
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

// 학원 공지·시험일정 화면은 기존 Firestore와 Firebase Storage를 계속 사용한다.
// 아래 두 export는 academy-board 전용이며 질문 시스템 저장소와는 분리된다.
export const db = getFirestore(app);
export const storage = getStorage(app);
