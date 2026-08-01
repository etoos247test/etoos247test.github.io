// Firebase Console > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성에서 복사합니다.
// 아래 문자열을 실제 프로젝트 값으로 교체하세요.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const appSettings = {
  // 승인 완료 후 이동할 페이지
  dashboardUrl: "./dashboard/",
  // 공용 PC가 많은 학원 환경을 고려해 세션 유지 방식을 사용합니다.
  sessionOnly: true
};
