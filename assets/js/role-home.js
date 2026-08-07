import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { auth, authPersistenceReady } from "../../question-access/firebase-client.js";

const API_BASE = "https://etoos247-qa-api.etoos247test.workers.dev";
const roleMode = document.body.dataset.role === "student" ? "student" : "teacher";
const $ = (id) => document.getElementById(id);

function campusLabel(value) {
  return value === "suseong1" ? "수성1관" : value === "suseong2" ? "수성2관" : "소속관 미지정";
}

function roleLabel(value) {
  return value === "master" ? "마스터 관리자" : value === "teacher" ? "교사" : value === "student" ? "학생" : "권한 미지정";
}

function setStatus(message, error = false) {
  const target = $("statusLine");
  target.textContent = message;
  target.classList.toggle("error", error);
}

async function api(user, path) {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `API 오류 ${response.status}`);
  return data;
}

function renderPetals() {
  const area = $("petals");
  if (!area || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const count = innerWidth < 650 ? 8 : 15;
  for (let i = 0; i < count; i += 1) {
    const petal = document.createElement("span");
    petal.className = "petal";
    petal.style.left = `${25 + Math.random() * 75}%`;
    petal.style.setProperty("--drift", `${-80 + Math.random() * 180}px`);
    petal.style.animationDuration = `${7 + Math.random() * 7}s`;
    petal.style.animationDelay = `${-Math.random() * 12}s`;
    area.appendChild(petal);
  }
}

function renderProfile(me) {
  const identity = me.identity || {};
  const profile = me.profile || {};
  const name = profile.name || identity.name || "사용자";
  const campus = campusLabel(profile.campus);
  const role = roleLabel(profile.role);
  $("welcomeName").textContent = roleMode === "teacher" ? `${name} 선생님` : name;
  $("profileName").textContent = name;
  $("profileEmail").textContent = identity.email || "이메일 정보 없음";
  $("profileCampus").textContent = campus;
  $("profileRole").textContent = role;
  $("headerUserName").textContent = name;
  $("headerUserMeta").textContent = `${campus} · ${role}`;
}

function renderStats(questions, students = []) {
  const all = Array.isArray(questions) ? questions : [];
  if (roleMode === "teacher") {
    $("statPrimary").textContent = all.filter((q) => q.status === "waiting_teacher").length;
    $("statSecondary").textContent = Array.isArray(students) ? students.length : 0;
    $("statThird").textContent = all.length;
  } else {
    $("statPrimary").textContent = all.filter((q) => q.status === "waiting_student").length;
    $("statSecondary").textContent = all.filter((q) => q.status !== "closed").length;
    $("statThird").textContent = all.length;
  }
}

function applyPermissions(profile) {
  const isMaster = profile.role === "master";
  const canManageStudents = isMaster || profile.can_approve_students === 1 || profile.can_manage_student_info === 1;
  document.querySelectorAll(".master-only").forEach((el) => el.classList.toggle("hidden-by-permission", !isMaster));
  document.querySelectorAll(".needs-student-admin").forEach((el) => el.classList.toggle("hidden-by-permission", !canManageStudents));
}

function redirectToLogin() {
  const target = roleMode === "teacher" ? "../../teacher-login/" : "../../question-access/?role=student";
  location.replace(target);
}

async function loadHome(user) {
  try {
    const me = await api(user, "/api/me");
    const profile = me.profile || {};
    const validTeacher = profile.active === 1 && ["teacher", "master"].includes(profile.role);
    const validStudent = profile.active === 1 && profile.role === "student";
    if ((roleMode === "teacher" && !validTeacher) || (roleMode === "student" && !validStudent)) {
      setStatus("현재 계정으로 이 홈을 이용할 수 없습니다. 로그인 화면으로 이동합니다.", true);
      setTimeout(redirectToLogin, 700);
      return;
    }

    renderProfile(me);
    applyPermissions(profile);
    const questionsPromise = api(user, "/api/questions").catch(() => ({ questions: [] }));
    const studentsPromise = roleMode === "teacher"
      ? api(user, "/api/students").catch(() => ({ students: [] }))
      : Promise.resolve({ students: [] });
    const [questionData, studentData] = await Promise.all([questionsPromise, studentsPromise]);
    renderStats(questionData.questions || [], studentData.students || []);
    setStatus(roleMode === "teacher" ? "현재 권한에 맞는 업무 메뉴를 불러왔습니다." : "내 학원생활 정보를 불러왔습니다.");
  } catch (error) {
    console.error(error);
    setStatus("홈 정보를 불러오지 못했습니다. 다시 로그인해 주세요.", true);
  }
}

$("logoutButton").addEventListener("click", async () => {
  await signOut(auth);
  location.replace("../../");
});

$("todayDate").textContent = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric", month: "long", day: "numeric", weekday: "long"
}).format(new Date());

renderPetals();
await authPersistenceReady;
onAuthStateChanged(auth, (user) => {
  if (!user) {
    redirectToLogin();
    return;
  }
  loadHome(user);
});
