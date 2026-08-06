import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, authPersistenceReady, db } from "../question-access/firebase-client.js";

const $ = (id) => document.getElementById(id);
let profile = null;
let user = null;
let tab = new URLSearchParams(location.search).get("tab") === "schedule" ? "schedule" : "notice";
let notices = [];
let schedules = [];

const campusName = (value) => value === "suseong1" ? "수성1관" : value === "suseong2" ? "수성2관" : "전체";
const isStaff = () => profile?.active === true && (profile.role === "teacher" || profile.role === "master");
const staffCampuses = () => profile?.role === "master"
  ? ["all", "suseong1", "suseong2"]
  : (Array.isArray(profile?.allowedCampuses) ? profile.allowedCampuses : []);
const canManageCampus = (campus) => profile?.role === "master"
  || (isStaff() && campus !== "all" && staffCampuses().includes(campus));

function status(text, type = "") {
  const element = $("authStatus");
  element.className = `auth ${type}`.trim();
  element.textContent = text;
}

function formatTimestamp(value) {
  return value?.toDate
    ? value.toDate().toLocaleString("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
      })
    : "저장 중";
}

function visibleToMe(row) {
  if (isStaff()) {
    return profile.role === "master" || row.campus === "all" || staffCampuses().includes(row.campus);
  }
  return row.visible === true && (row.campus === "all" || row.campus === profile?.campus);
}

function setupCampusSelect() {
  for (const id of ["noticeCampus", "scheduleCampus"]) {
    const select = $(id);
    select.innerHTML = "";
    staffCampuses().forEach((campus) => {
      const option = document.createElement("option");
      option.value = campus;
      option.textContent = campusName(campus);
      select.appendChild(option);
    });
  }
}

function setTab(next) {
  tab = next;
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === next);
  });
  $("noticeView").classList.toggle("hidden", next !== "notice");
  $("scheduleView").classList.toggle("hidden", next !== "schedule");
  $("noticeForm").classList.toggle("hidden", next !== "notice");
  $("scheduleForm").classList.toggle("hidden", next !== "schedule");
  history.replaceState(null, "", `?tab=${next}`);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function renderNotices() {
  const rows = notices
    .filter(visibleToMe)
    .sort((a, b) => (b.pinned === true) - (a.pinned === true)
      || ((b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0)));

  $("noticeView").innerHTML = rows.length ? "" : '<div class="empty">등록된 학원공지가 없습니다.</div>';
  rows.forEach((row) => {
    const article = document.createElement("article");
    article.className = `card ${row.pinned ? "pinned" : ""}`;
    article.innerHTML = `
      <div class="card-head">
        <div>
          <h2>${escapeHtml(row.title)}</h2>
          <div class="meta">${campusName(row.campus)} · 입력 ${formatTimestamp(row.createdAt)} · 수정 ${formatTimestamp(row.updatedAt)}</div>
        </div>
        <div class="tags">
          ${row.pinned ? '<span class="tag">고정</span>' : ""}
          <span class="tag ${row.visible ? "" : "hidden-tag"}">${row.visible ? "학생 공개" : "비공개"}</span>
        </div>
      </div>
      <div class="content">${escapeHtml(row.content)}</div>`;

    if (isStaff() && canManageCampus(row.campus)) {
      const actions = document.createElement("div");
      actions.className = "admin-actions";
      actions.innerHTML = '<button class="edit">수정</button><button class="delete">삭제</button>';
      actions.children[0].addEventListener("click", () => editNotice(row));
      actions.children[1].addEventListener("click", () => removeRecord("academyNotices", row.id));
      article.appendChild(actions);
    }
    $("noticeView").appendChild(article);
  });
}

function renderSchedules() {
  const rows = schedules
    .filter(visibleToMe)
    .sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));

  $("scheduleView").innerHTML = rows.length ? "" : '<div class="empty">등록된 시험일정이 없습니다.</div>';
  rows.forEach((row) => {
    const article = document.createElement("article");
    article.className = "card";
    article.innerHTML = `
      <div class="schedule-grid">
        <div class="schedule-date">${escapeHtml(row.examDate || "날짜 미정")}</div>
        <div>
          <div class="card-head">
            <div>
              <h2>${escapeHtml(row.periodLabel)} · ${escapeHtml(row.title)}</h2>
              <div class="meta">${campusName(row.campus)} · 입력 ${formatTimestamp(row.createdAt)}</div>
            </div>
            <span class="tag ${row.visible ? "" : "hidden-tag"}">${row.visible ? "학생 공개" : "비공개"}</span>
          </div>
          <div class="content">${escapeHtml(row.description || "별도 안내 없음")}</div>
        </div>
      </div>`;

    if (isStaff() && canManageCampus(row.campus)) {
      const actions = document.createElement("div");
      actions.className = "admin-actions";
      actions.innerHTML = '<button class="edit">수정</button><button class="delete">삭제</button>';
      actions.children[0].addEventListener("click", () => editSchedule(row));
      actions.children[1].addEventListener("click", () => removeRecord("examSchedules", row.id));
      article.appendChild(actions);
    }
    $("scheduleView").appendChild(article);
  });
}

function render() {
  renderNotices();
  renderSchedules();
}

async function load() {
  try {
    const [noticeSnapshot, scheduleSnapshot] = await Promise.all([
      getDocs(collection(db, "academyNotices")),
      getDocs(collection(db, "examSchedules"))
    ]);
    notices = noticeSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    schedules = scheduleSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    render();
  } catch (error) {
    status(`자료를 불러오지 못했습니다. Firestore 규칙 배포 여부를 확인하세요.\n${error.message}`, "error");
  }
}

function resetNotice() {
  $("noticeForm").reset();
  $("noticeId").value = "";
  $("noticeVisible").checked = true;
  setupCampusSelect();
}

function resetSchedule() {
  $("scheduleForm").reset();
  $("scheduleId").value = "";
  $("scheduleVisible").checked = true;
  setupCampusSelect();
}

function editNotice(row) {
  setTab("notice");
  $("noticeId").value = row.id;
  $("noticeCampus").value = row.campus;
  $("noticeTitle").value = row.title;
  $("noticeContent").value = row.content;
  $("noticePinned").checked = Boolean(row.pinned);
  $("noticeVisible").checked = Boolean(row.visible);
  scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function editSchedule(row) {
  setTab("schedule");
  $("scheduleId").value = row.id;
  $("scheduleCampus").value = row.campus;
  $("examDate").value = row.examDate;
  $("periodLabel").value = row.periodLabel;
  $("examTitle").value = row.title;
  $("examDescription").value = row.description || "";
  $("scheduleVisible").checked = Boolean(row.visible);
  scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

async function removeRecord(collectionName, id) {
  if (!confirm("이 자료를 삭제할까요?")) return;
  try {
    await deleteDoc(doc(db, collectionName, id));
    await load();
  } catch (error) {
    status(`삭제하지 못했습니다.\n${error.message}`, "error");
  }
}

$("noticeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("noticeId").value;
  const data = {
    campus: $("noticeCampus").value,
    title: $("noticeTitle").value.trim(),
    content: $("noticeContent").value.trim(),
    pinned: $("noticePinned").checked,
    visible: $("noticeVisible").checked,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedByName: user.displayName || profile.name || ""
  };
  try {
    if (id) {
      await updateDoc(doc(db, "academyNotices", id), data);
    } else {
      await addDoc(collection(db, "academyNotices"), {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByName: user.displayName || profile.name || ""
      });
    }
    resetNotice();
    status("학원공지가 저장되었습니다.", "success");
    await load();
  } catch (error) {
    status(`공지를 저장하지 못했습니다.\n${error.message}`, "error");
  }
});

$("scheduleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("scheduleId").value;
  const data = {
    campus: $("scheduleCampus").value,
    examDate: $("examDate").value,
    periodLabel: $("periodLabel").value.trim(),
    title: $("examTitle").value.trim(),
    description: $("examDescription").value.trim(),
    visible: $("scheduleVisible").checked,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedByName: user.displayName || profile.name || ""
  };
  try {
    if (id) {
      await updateDoc(doc(db, "examSchedules", id), data);
    } else {
      await addDoc(collection(db, "examSchedules"), {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByName: user.displayName || profile.name || ""
      });
    }
    resetSchedule();
    status("시험일정이 저장되었습니다.", "success");
    await load();
  } catch (error) {
    status(`시험일정을 저장하지 못했습니다.\n${error.message}`, "error");
  }
});

$("noticeCancel").addEventListener("click", resetNotice);
$("scheduleCancel").addEventListener("click", resetSchedule);
document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => setTab(button.dataset.tab));
});
setTab(tab);

await authPersistenceReady;
onAuthStateChanged(auth, async (currentUser) => {
  user = currentUser;
  if (!currentUser) {
    status("로그인이 필요합니다. 교사용 또는 학생용 로그인 화면에서 먼저 로그인하세요.", "error");
    return;
  }

  const snapshot = await getDoc(doc(db, "users", currentUser.uid));
  profile = snapshot.exists() ? snapshot.data() : null;
  if (!profile?.active) {
    status("활성 사용자 권한이 없습니다. 관리자에게 문의하세요.", "error");
    return;
  }

  status(`${profile.role === "student" ? "학생" : "교사"} 권한 확인 완료 · ${campusName(profile.campus || "all")}`, "success");
  if (isStaff()) {
    setupCampusSelect();
    $("editor").classList.remove("hidden");
  }
  await load();
});
