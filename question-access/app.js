import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, authPersistenceReady, db, provider } from "./firebase-client.js";
import {
  els, state, showStatus, hidePanels, userSummary, timeout, isMaster, isQuasiMaster,
  allowedCampuses, campusLabel, campusFromStudentId
} from "./shared.js";
import { loadStudentQuestions, submitQuestion } from "./student.js";
import { showStudentApplicationPanel, submitStudentApplication } from "./student-application.js";
import { configureStudentApprovalPanel, loadStudentApplications } from "./student-approval.js";
import { resetTeacherView, loadTeacherWorkspace, bindTeacherFilters } from "./teacher.js";
import { loadTeacherRequests, loadApprovedTeachers, requestTeacherRole } from "./master.js";
import {
  hideRoleMenu, showStudentRoleMenu, showTeacherRoleMenu, replaceSharedLinks
} from "./role-menu.js";

const AUTH_INTENT_KEY = "etoos247AuthIntent";

async function loadAccountView(user) {
  state.currentUser = user;
  state.currentProfile = null;
  state.currentStudentApplication = null;
  hidePanels();
  hideRoleMenu();
  configureStudentApprovalPanel();
  showStatus(`계정 권한을 확인하는 중입니다.\n\n${userSummary(user)}`);

  try {
    const profileSnap = await timeout(
      getDoc(doc(db, "users", user.uid)),
      10000,
      "사용자 권한 조회 시간이 초과되었습니다."
    );
    if (profileSnap.exists()) state.currentProfile = profileSnap.data();

    const role = state.currentProfile?.role;
    const active = state.currentProfile?.active === true;

    if (role === "student" && active) {
      const studentId = String(state.currentProfile?.studentId ?? "").trim().toUpperCase();
      const codeCampus = campusFromStudentId(studentId);
      if (!codeCampus || codeCampus !== state.currentProfile?.campus) {
        showStatus(
          "학생번호와 소속관 정보가 일치하지 않습니다.\n" +
          "수성1관은 M001~M199, 수성2관은 S001~S199를 사용합니다. 관리자에게 수정을 요청하세요.",
          "error"
        );
        return;
      }

      els.studentPanel.classList.remove("hidden");
      showStudentRoleMenu();
      const campus = campusLabel(state.currentProfile.campus);
      showStatus(
        `${userSummary(user)}\n\n권한: 학생\n내부 학생번호: ${studentId}\n소속: ${campus}\n학생 개인 메뉴가 열렸습니다.`,
        "success"
      );
      await loadStudentQuestions();
      return;
    }

    if (role === "student" && !active) {
      showStatus(`${userSummary(user)}\n\n학생 이용이 중지된 상태입니다. 해당 관 관리자에게 문의하세요.`, "error");
      return;
    }

    if (role === "teacher" && active) {
      els.teacherPanel.classList.remove("hidden");
      showTeacherRoleMenu();
      resetTeacherView();
      configureStudentApprovalPanel();
      const campuses = allowedCampuses().map(campusLabel).join(" · ") || "미지정";
      const level = isQuasiMaster() ? "준마스터 교사" : "일반 교사";
      showStatus(`${userSummary(user)}\n\n권한: ${level}\n관리 지점: ${campuses}\n교사용 업무 메뉴가 열렸습니다.`, "success");
      await Promise.all([loadTeacherWorkspace(), loadStudentApplications()]);
      return;
    }

    if (isMaster() && active) {
      els.masterPanel.classList.remove("hidden");
      els.teacherPanel.classList.remove("hidden");
      showTeacherRoleMenu();
      resetTeacherView();
      configureStudentApprovalPanel();
      showStatus(`${userSummary(user)}\n\n권한: 마스터\n수성1관·수성2관 전체 관리 메뉴가 열렸습니다.`, "success");
      await Promise.all([
        loadTeacherRequests(),
        loadApprovedTeachers(),
        loadTeacherWorkspace(),
        loadStudentApplications()
      ]);
      return;
    }

    if (role === "teacher" && !active) {
      showStatus(`${userSummary(user)}\n\n교사 계정이 이용 중지 상태입니다. 마스터에게 문의하세요.`, "error");
      return;
    }

    const intent = sessionStorage.getItem(AUTH_INTENT_KEY) || "staff";
    const [studentApplicationSnap, teacherRequestSnap] = await Promise.all([
      getDoc(doc(db, "studentApplications", user.uid)),
      getDoc(doc(db, "teacherRequests", user.uid))
    ]);
    const application = studentApplicationSnap.exists() ? studentApplicationSnap.data() : null;

    if (intent.startsWith("student") || application) {
      showStudentApplicationPanel(user, application);
      if (!application && intent === "studentLogin") {
        showStatus(
          `${userSummary(user)}\n\n이 Google 계정은 아직 학생 승인을 받지 않았습니다. 학생 가입 신청을 먼저 저장하세요.`,
          "warning"
        );
      } else if (application?.status === "pending") {
        showStatus(`${userSummary(user)}\n\n학생 가입 요청이 승인 대기 중입니다.`, "warning");
      } else if (application?.status === "rejected") {
        showStatus(`${userSummary(user)}\n\n학생 가입 요청이 반려되었습니다. 정보를 확인해 다시 신청하세요.`, "error");
      } else if (application?.status === "approved") {
        showStatus(`${userSummary(user)}\n\n승인 기록은 있으나 학생 권한 문서가 없습니다. 관리자에게 문의하세요.`, "error");
      } else {
        showStatus(`${userSummary(user)}\n\nGoogle 계정 확인 완료. 학생 가입정보를 입력하세요.`, "success");
      }
      return;
    }

    els.requestPanel.classList.remove("hidden");
    if (!teacherRequestSnap.exists()) {
      els.requestText.textContent = "교사 권한이 아직 없습니다. 마스터에게 승인 요청을 보내세요.";
      els.requestButton.textContent = "교사 권한 승인 요청";
      els.requestButton.disabled = false;
      showStatus(`${userSummary(user)}\n\n교사 등록 요청: 아직 없음`, "warning");
    } else {
      const request = teacherRequestSnap.data();
      els.requestText.textContent = request.status === "pending"
        ? "교사 등록 요청이 접수되었습니다. 마스터가 관리 지점과 권한을 지정합니다."
        : `교사 요청 상태: ${request.status}`;
      els.requestButton.textContent = request.status === "pending" ? "승인 대기 중" : "교사 권한 다시 요청";
      els.requestButton.disabled = request.status === "pending";
      showStatus(
        `${userSummary(user)}\n\n교사 등록 요청 상태: ${request.status}`,
        request.status === "pending" ? "warning" : "error"
      );
    }
  } catch (error) {
    console.error(error);
    showStatus(`권한 확인에 실패했습니다.\n오류 코드: ${error.code ?? "확인 불가"}\n${error.message ?? String(error)}`, "error");
  }
}

async function googleLogin(button, intent) {
  button.disabled = true;
  sessionStorage.setItem(AUTH_INTENT_KEY, intent);
  try {
    await authPersistenceReady;
    await signInWithPopup(auth, provider);
  } catch (error) {
    const message = error.code === "auth/popup-blocked"
      ? "브라우저가 로그인 팝업을 차단했습니다. 주소창 오른쪽에서 팝업을 허용한 뒤 다시 누르세요."
      : error.code === "auth/popup-closed-by-user"
        ? "Google 로그인 창을 닫았습니다. 다시 로그인 버튼을 누르세요."
        : error.message ?? String(error);
    showStatus(`Google 로그인에 실패했습니다.\n오류 코드: ${error.code ?? "확인 불가"}\n${message}`, "error");
  } finally {
    button.disabled = false;
  }
}

els.studentApplicationForm.addEventListener("submit", submitStudentApplication);
els.questionForm.addEventListener("submit", submitQuestion);
els.requestButton.addEventListener("click", requestTeacherRole);
els.logoutButton.addEventListener("click", async () => {
  sessionStorage.removeItem(AUTH_INTENT_KEY);
  hideRoleMenu();
  await signOut(auth);
});
els.refreshButton.addEventListener("click", () => state.currentUser && loadAccountView(state.currentUser));
els.googleLoginButton.addEventListener("click", () => googleLogin(els.googleLoginButton, "staff"));
els.studentSignupButton.addEventListener("click", () => googleLogin(els.studentSignupButton, "studentSignup"));
els.studentGoogleLoginButton.addEventListener("click", () => googleLogin(els.studentGoogleLoginButton, "studentLogin"));
els.googleSwitchButton.addEventListener("click", () => googleLogin(
  els.googleSwitchButton,
  sessionStorage.getItem(AUTH_INTENT_KEY) || "staff"
));

replaceSharedLinks();
bindTeacherFilters();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    state.currentUser = null;
    state.currentProfile = null;
    state.currentStudentApplication = null;
    state.teacherQuestions = [];
    state.approvedStudents = [];
    els.loginArea.classList.remove("hidden");
    els.accountToolbar.classList.add("hidden");
    hidePanels();
    hideRoleMenu();
    configureStudentApprovalPanel();
    showStatus("로그인하지 않았습니다. 학생·교사·마스터 모두 Google 로그인 버튼을 사용합니다.");
    return;
  }

  els.loginArea.classList.add("hidden");
  els.accountToolbar.classList.remove("hidden");
  await loadAccountView(user);
});
