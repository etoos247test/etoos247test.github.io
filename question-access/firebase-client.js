import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-functions.js";

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
export const db = getFirestore(app);
const functions = getFunctions(app, "asia-northeast3");
export const createStudentAccountCallable = httpsCallable(functions, "createStudentAccount");
export const resetStudentPasswordCallable = httpsCallable(functions, "resetStudentPassword");
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
auth.languageCode = "ko";
