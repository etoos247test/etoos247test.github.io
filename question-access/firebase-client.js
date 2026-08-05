import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  browserSessionPersistence, getAuth, GoogleAuthProvider, setPersistence
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

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
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
auth.languageCode = "ko";

// Students, teachers, and masters all authenticate with Google.
// M001~M199 and S001~S199 are internal student numbers, not login accounts.
