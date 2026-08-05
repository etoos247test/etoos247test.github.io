import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db, provider } from "./firebase-client.js";
import {
  els, state, showStatus, hidePanels, userSummary, timeout, isMaster, isQuasiMaster,
  allowedCampuses, campusLabel
} from "./shared.js";
import { studentLogin, loadStudentQuestions, submitQuestion } from "./student.js";
import { resetTeacherView, loadTeacherWorkspace, bindTeacherFilters } from "./teacher.js";
import { loadTeacherRequests, loadApprovedTeachers, requestTeacherRole } from "./master.js";

async function loadAccountView(user) {
  state.currentUser = user;
  state.currentProfile = null;
  hidePanels();
  showStatus(`계정 권한을 확인하는 중입니다.\n\n${userSummary(user)}`);

  try {
    const profileSnap = await timeout(getDoc(doc(db, "users", user.uid)), 10000, "사용자 권한 조회 시간이 초과되었습니다.");
    if (profileSnap.exists()) state.currentProfile = profileSnap.data();

    const role = state.currentProfile?.role;
    const active = state.currentProfile?.active === true;

    if (role === "student" && active) {
      els.studentPanel.classList.remove("hidden");
      const campus = campusLabel(state.currentProfile?.campus);
      showStatus(`${userSummary(user)}\n\n권한: 학생\n소속: ${campus}\n학생 질문 화면이 열렸습니다.`, "success");
      await loadStudentQuestions();
      return;
    }

    if (role === "teacher" && active) {
      els.teacherPanel.classList.remove("hidden");
      resetTeacherView();
      const campuses = allowedCampuses().map(campusLabel).join(" · ") || "미지정";
      const level = isQuasiMaster() ? "준마스터 교사" : "일반 교사";
      showStatus(`${userSummary(user)}\n\n권한: ${level}\n관리 지점: ${campuses}\n허용된 지점 학생만 표시됩니다.`, "success");
      await loadTeacherWorkspace();
      return;
    }

    if (isMaster() && active) {
      els.masterPanel.classList.remove("hidden");
      els.teacherPanel.classList.remove("hidden");
      resetTeacherView();
      showStatus(`${userSummary(user)}\n\n권한: 마스터\n수성1관·수성2관 전체 관리 화면이 열렸습니다.`, "success");
      await Promise.all([loadTeacherRequests(), loadApprovedTeachers(), loadTeacherWorkspace()]);
      return;
    }

    if (role === "teacher" && !active) {
      showStatus(`${userSummary(user)}\n\n교사 계정이 이용 중지 상태입니다. 마스터에게 문의하세요.`, "error");
      return;
    }

    if (user.providerData?.[0]?.providerId === "password") {
      showStatus(`${userSummary(user)}\n\n학생 사용자 문서가 없거나 승인되지 않았습니다.`, "error");
      return;
    }

    els.requestPanel.classList.remove("hidden");
    const requestSnap = await getDoc(doc(db, "teacherRequests", user.uid));
    if (!requestSnap.exists()) {
      els.requestText.textContent = "교사 권한이 아직 없습니다. 마스터에게 승인 요청을 보내세요.";
      els.requestButton.textContent = "교사 권한 승인 요청";
      els.requestButton.disabled = false;
      showStatus(`${userSummary(user)}\n\n교사 등록 요청: 아직 없음`, "warning");
    } else {
      const request = requestSnap.data();
      els.requestText.textContent = request.status === "pending"
        ? "교사 등록 요청이 접수되었습니다. 마스터가 관리 지점과 권한을 지정합니다."
        : `교사 요청 상태: ${request.status}`;
      els.requestButton.textContent = request.status === "pending" ? "승인 대기 중" : "교사 권한 다시 요청";
      els.requestButton.disabled = request.status === "pending";
      showStatus(`${userSummary(user)}\n\n교사 등록 요청 상태: ${request.status}`, request.status === "pending" ? "warning" : "error");
    }
  } catch (error) {
    console.error(error);
    showStatus(`권한 확인에 실패했습니다.\n오류 코드: ${error.code ?? "확인 불가"}\n${error.message ?? String(error)}`, "error");
  }
}

els.studentLoginForm.addEventListener("submit", studentLogin);
els.questionForm.addEventListener("submit", submitQuestion);
els.requestButton.addEventListener("click", requestTeacherRole);
els.logoutButton.addEventListener("click", () => signOut(auth));
els.refreshButton.addEventListener("click", () => state.currentUser && loadAccountView(state.currentUser));
els.googleLoginButton.addEventListener("click", async () => {
  els.googleLoginButton.disabled = true;
  try { await signInWithPopup(auth, provider); }
  catch (error) { showStatus(`Google 로그인에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error"); }
  finally { els.googleLoginButton.disabled = false; }
});

bindTeacherFilters();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    state.currentUser = null;
    state.currentProfile = null;
    state.teacherQuestions = [];
    state.approvedStudents = [];
    els.loginArea.classList.remove("hidden");
    els.accountToolbar.classList.add("hidden");
    hidePanels();
    showStatus("로그인하지 않았습니다.");
    return;
  }
  els.loginArea.classList.add("hidden");
  els.accountToolbar.classList.remove("hidden");
  await loadAccountView(user);
});
