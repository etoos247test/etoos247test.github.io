import {
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  auth,
  authPersistenceReady,
  provider
} from "./firebase-client.js";

const API_BASE = "https://etoos247-qa-api.etoos247test.workers.dev";
const AUTH_INTENT_KEY = "etoos247UnifiedAuthIntent";
const MAX_IMAGE_BYTES = 1048576;
const MAX_IMAGES = 3;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const $ = (id) => document.getElementById(id);
const els = Object.fromEntries([
  "loginArea", "accountBar", "accountName", "accountMeta", "status",
  "studentApplicationPanel", "studentApplicationBadge", "studentApplicationForm",
  "studentApplicationCampus", "studentApplicationName", "studentApplicationContact",
  "teacherRequestPanel", "teacherRequestBadge", "teacherRequestForm", "teacherRequestName",
  "studentWorkspace", "staffWorkspace", "threadPanel", "studentAdminPanel", "masterAdminPanel",
  "questionForm", "questionSubject", "questionText", "questionImages",
  "questionImagePreview", "questionSubmitBtn", "studentQuestionList", "studentQuestionCount",
  "studentSearch", "subjectFilter", "statusFilter", "studentDirectory",
  "staffQuestionList", "staffQuestionCount", "staffQuestionTitle", "permissionBadges",
  "threadTitle", "threadMeta", "messageList", "replyForm", "replyText",
  "replyImages", "replyImagePreview", "replySubmitBtn", "closeQuestionBtn",
  "reopenQuestionBtn", "closeThreadBtn", "studentApplicationList",
  "studentManagementList", "teacherRequestList", "teacherManagementList",
  "imageModal", "imageModalImage", "imageModalCaption"
].map((id) => [id, $(id)]));

const state = {
  user: null,
  me: null,
  questions: [],
  students: [],
  selectedStudentUid: null,
  selectedQuestionId: null,
  questionFiles: [],
  replyFiles: [],
  objectUrls: []
};

function campusLabel(value) {
  return value === "suseong1" ? "수성1관" : value === "suseong2" ? "수성2관" : "미지정";
}

function statusLabel(value) {
  return {
    waiting_teacher: "교사 답변 대기",
    waiting_student: "학생 확인 대기",
    closed: "종료"
  }[value] || value || "상태 없음";
}

function statusClass(value) {
  return value === "waiting_teacher"
    ? "waiting"
    : value === "waiting_student"
      ? "answered"
      : value === "closed"
        ? "closed"
        : "neutral";
}

function applicationStatusLabel(value) {
  return {
    pending: "승인 대기",
    approved: "승인 완료",
    rejected: "반려"
  }[value] || "미신청";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function escapeText(value) {
  return String(value ?? "");
}

function setStatus(message, type = "") {
  els.status.textContent = message;
  els.status.className = `status ${type}`.trim();
}

function setBadge(element, text, type = "neutral") {
  element.textContent = text;
  element.className = `badge ${type}`;
}

function hideAllPanels() {
  [
    els.studentApplicationPanel,
    els.teacherRequestPanel,
    els.studentWorkspace,
    els.staffWorkspace,
    els.threadPanel,
    els.studentAdminPanel,
    els.masterAdminPanel
  ].forEach((element) => element.classList.add("hidden"));
}

function resetData() {
  state.me = null;
  state.questions = [];
  state.students = [];
  state.selectedStudentUid = null;
  state.selectedQuestionId = null;
  state.questionFiles = [];
  state.replyFiles = [];
  revokeObjectUrls();
  els.questionImagePreview.innerHTML = "";
  els.replyImagePreview.innerHTML = "";
  els.studentQuestionList.innerHTML = "";
  els.staffQuestionList.innerHTML = "";
  els.studentDirectory.innerHTML = "";
  els.messageList.innerHTML = "";
}

function revokeObjectUrls() {
  state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.objectUrls = [];
}

async function getToken(force = false) {
  if (!state.user) throw new Error("먼저 Google 로그인을 해야 합니다.");
  return state.user.getIdToken(force);
}

async function api(path, options = {}) {
  const {
    method = "GET",
    jsonBody,
    formData,
    responseType = "json"
  } = options;
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  let body;
  if (jsonBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(jsonBody);
  } else if (formData) {
    body = formData;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body,
    cache: "no-store"
  });

  if (responseType === "blob") {
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `API 오류 ${response.status}`);
    }
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `API 오류 ${response.status}`);
  }
  return data;
}

function accountSummary() {
  const identity = state.me?.identity || {};
  const profile = state.me?.profile || {};
  els.accountName.textContent = identity.name || profile.name || identity.email || "로그인 사용자";
  const details = [identity.email, identity.uid ? `UID ${identity.uid}` : ""].filter(Boolean);
  if (profile.role) details.push(`권한 ${profile.role}`);
  if (profile.campus) details.push(campusLabel(profile.campus));
  if (profile.student_id) details.push(profile.student_id);
  els.accountMeta.textContent = details.join(" · ");
}

function rolePermissionBadges() {
  const profile = state.me?.profile || {};
  const campuses = state.me?.campuses || [];
  const values = [
    profile.role === "master" ? "마스터" : "교사",
    ...campuses.map(campusLabel),
    profile.can_answer_questions === 1 ? "질문 답변" : "답변 미허용",
    profile.can_approve_students === 1 ? "학생 승인" : "승인 미허용",
    profile.can_manage_student_info === 1 ? "학생정보 관리" : "정보관리 미허용"
  ];
  els.permissionBadges.innerHTML = values
    .map((value, index) => `<span class="permission-badge ${index < 2 || !value.includes("미허용") ? "on" : ""}">${value}</span>`)
    .join("");
}

async function loadAccountView() {
  hideAllPanels();
  setStatus("Firebase 로그인 토큰으로 Cloudflare 권한을 확인하는 중입니다.");
  state.me = await api("/api/me");
  accountSummary();

  const profile = state.me.profile;
  const identity = state.me.identity;
  const studentApplication = state.me.studentApplication;
  const teacherRequest = state.me.teacherRequest;
  const intent = sessionStorage.getItem(AUTH_INTENT_KEY) || (
    document.documentElement.dataset.entryRole === "student" ? "studentLogin" : "staff"
  );

  if (profile?.active === 1 && profile.role === "student") {
    els.studentWorkspace.classList.remove("hidden");
    setStatus(
      `${identity.email}\n학생 권한 확인 완료 · ${campusLabel(profile.campus)} · ${profile.student_id}`,
      "success"
    );
    await loadQuestions();
    return;
  }

  if (profile?.active === 1 && ["teacher", "master"].includes(profile.role)) {
    els.staffWorkspace.classList.remove("hidden");
    rolePermissionBadges();
    setStatus(
      `${identity.email}\n${profile.role === "master" ? "마스터" : "교사"} 권한 확인 완료`,
      "success"
    );
    await Promise.all([loadQuestions(), loadStudents()]);
    if (profile.role === "master" || profile.can_approve_students === 1 || profile.can_manage_student_info === 1) {
      els.studentAdminPanel.classList.remove("hidden");
      await loadStudentAdmin();
    }
    if (profile.role === "master") {
      els.masterAdminPanel.classList.remove("hidden");
      await loadMasterAdmin();
    }
    return;
  }

  if (profile?.role === "student" && profile.active !== 1) {
    setStatus("학생 계정이 이용 중지 상태입니다. 해당 관 관리자에게 문의하세요.", "error");
    return;
  }
  if (profile?.role === "teacher" && profile.active !== 1) {
    setStatus("교사 계정이 이용 중지 상태입니다. 마스터에게 문의하세요.", "error");
    return;
  }

  const chooseStudent = intent.startsWith("student") || Boolean(studentApplication);
  if (chooseStudent) {
    showStudentApplication(identity, studentApplication);
  } else {
    showTeacherRequest(identity, teacherRequest);
  }
}

function showStudentApplication(identity, application) {
  els.studentApplicationPanel.classList.remove("hidden");
  els.studentApplicationName.value = application?.name || identity.name || "";
  els.studentApplicationCampus.value = application?.campus || "";
  els.studentApplicationContact.value = application?.contact_last4 || "";
  const currentStatus = application?.status;
  setBadge(
    els.studentApplicationBadge,
    applicationStatusLabel(currentStatus),
    currentStatus === "approved" ? "answered" : currentStatus === "rejected" ? "closed" : "waiting"
  );

  if (currentStatus === "pending") {
    setStatus("학생 가입 요청이 D1에 저장됐으며 승인 대기 중입니다.", "warning");
  } else if (currentStatus === "rejected") {
    setStatus("학생 가입 요청이 반려됐습니다. 정보를 확인해 다시 신청할 수 있습니다.", "error");
  } else if (currentStatus === "approved") {
    setStatus("승인 기록은 있으나 활성 학생 권한이 완성되지 않았습니다. 관리자에게 문의하세요.", "error");
  } else {
    setStatus("Google 계정 확인 완료. 학생 가입정보를 입력하세요.", "success");
  }
}

function showTeacherRequest(identity, request) {
  els.teacherRequestPanel.classList.remove("hidden");
  els.teacherRequestName.value = request?.name || identity.name || "";
  const currentStatus = request?.status;
  setBadge(
    els.teacherRequestBadge,
    applicationStatusLabel(currentStatus),
    currentStatus === "approved" ? "answered" : currentStatus === "rejected" ? "closed" : "waiting"
  );
  if (currentStatus === "pending") {
    setStatus("교사 권한 요청이 D1에 저장됐으며 마스터 승인 대기 중입니다.", "warning");
  } else if (currentStatus === "rejected") {
    setStatus("교사 권한 요청이 반려됐습니다. 다시 요청할 수 있습니다.", "error");
  } else {
    setStatus("교사 권한이 없습니다. 이름을 확인하고 승인 요청을 보내세요.", "warning");
  }
}

async function login(intent, button) {
  button.disabled = true;
  sessionStorage.setItem(AUTH_INTENT_KEY, intent);
  try {
    await authPersistenceReady;
    await signInWithPopup(auth, provider);
  } catch (error) {
    const message = error.code === "auth/popup-blocked"
      ? "브라우저가 팝업을 차단했습니다. 주소창 오른쪽에서 팝업을 허용하세요."
      : error.code === "auth/popup-closed-by-user"
        ? "Google 로그인 창을 닫았습니다."
        : error.message || String(error);
    setStatus(`Google 로그인 실패\n${message}`, "error");
  } finally {
    button.disabled = false;
  }
}

async function loadImageElement(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

async function compressImage(file) {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error(`${file.name}: JPG·PNG·WebP 형식만 첨부할 수 있습니다.`);
  }
  if (file.size <= MAX_IMAGE_BYTES) return file;

  const image = await loadImageElement(file);
  let width = image.naturalWidth;
  let height = image.naturalHeight;
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  for (let resizeRound = 0; resizeRound < 5; resizeRound += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46]) {
      const blob = await canvasBlob(canvas, quality);
      if (blob && blob.size <= MAX_IMAGE_BYTES) {
        const base = file.name.replace(/\.[^.]+$/, "") || "image";
        return new File([blob], `${base}.webp`, {
          type: "image/webp",
          lastModified: Date.now()
        });
      }
    }
    width = Math.max(480, Math.round(width * 0.78));
    height = Math.max(480, Math.round(height * 0.78));
  }
  throw new Error(`${file.name}: 1MB 이하로 압축하지 못했습니다. 더 작은 사진을 선택하세요.`);
}

function bytesLabel(value) {
  return value < 1048576
    ? `${Math.max(1, Math.round(value / 1024))}KB`
    : `${(value / 1048576).toFixed(2)}MB`;
}

function renderSelectedImages(container, files, onRemove) {
  container.innerHTML = "";
  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    state.objectUrls.push(url);
    const item = document.createElement("div");
    item.className = "image-chip";
    const img = document.createElement("img");
    img.src = url;
    img.alt = file.name;
    const info = document.createElement("span");
    info.textContent = `${file.name} · ${bytesLabel(file.size)}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.addEventListener("click", () => onRemove(index));
    item.append(img, info, remove);
    container.appendChild(item);
  });
}

async function prepareFiles(input, targetKey, previewElement) {
  const selected = Array.from(input.files || []);
  input.value = "";
  if (!selected.length) return;
  if (selected.length > MAX_IMAGES) {
    setStatus(`사진은 한 번에 최대 ${MAX_IMAGES}장까지 선택할 수 있습니다.`, "warning");
    return;
  }

  setStatus("사진을 1MB 이하로 준비하는 중입니다.");
  try {
    const compressed = [];
    for (const file of selected) compressed.push(await compressImage(file));
    state[targetKey] = compressed;
    const refreshPreview = () => {
      revokeObjectUrls();
      renderSelectedImages(previewElement, state[targetKey], (index) => {
        state[targetKey].splice(index, 1);
        refreshPreview();
      });
    };
    refreshPreview();
    setStatus(`사진 ${compressed.length}장을 준비했습니다.`, "success");
  } catch (error) {
    state[targetKey] = [];
    previewElement.innerHTML = "";
    setStatus(error.message, "error");
  }
}

async function loadQuestions() {
  const data = await api("/api/questions");
  state.questions = data.questions || [];
  if (state.me.profile.role === "student") renderStudentQuestions();
  else renderStaffQuestions();
}

function questionCard(question, role) {
  const article = document.createElement("article");
  article.className = "question-card";
  const top = document.createElement("div");
  top.className = "question-card-top";
  const title = document.createElement("strong");
  title.textContent = role === "student"
    ? `${question.subject} · ${statusLabel(question.status)}`
    : `${question.student_name} ${question.student_id} · ${question.subject}`;
  const badge = document.createElement("span");
  badge.className = `badge ${statusClass(question.status)}`;
  badge.textContent = statusLabel(question.status);
  top.append(title, badge);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${campusLabel(question.campus)} · 최근 ${formatDate(question.last_message_at)}`;

  const action = document.createElement("button");
  action.className = "button secondary small";
  action.type = "button";
  action.textContent = "대화 열기";
  action.addEventListener("click", () => openThread(question.id));

  article.append(top, meta, action);
  return article;
}

function renderStudentQuestions() {
  els.studentQuestionList.innerHTML = "";
  setBadge(els.studentQuestionCount, `${state.questions.length}건`, "neutral");
  if (!state.questions.length) {
    els.studentQuestionList.innerHTML = '<div class="empty">아직 등록한 질문이 없습니다.</div>';
    return;
  }
  state.questions.forEach((question) => {
    els.studentQuestionList.appendChild(questionCard(question, "student"));
  });
}

async function loadStudents() {
  const data = await api("/api/students");
  state.students = data.students || [];
  renderStudentDirectory();
}

function visibleStudents() {
  const keyword = els.studentSearch.value.trim().toLowerCase();
  if (!keyword) return state.students;
  return state.students.filter((student) =>
    [student.name, student.student_id, campusLabel(student.campus), student.email]
      .some((value) => String(value || "").toLowerCase().includes(keyword))
  );
}

function renderStudentDirectory() {
  els.studentDirectory.innerHTML = "";
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `student-card ${state.selectedStudentUid ? "" : "active"}`;
  allButton.innerHTML = `<strong>전체 학생</strong><span>${state.questions.length}개 질문</span>`;
  allButton.addEventListener("click", () => {
    state.selectedStudentUid = null;
    renderStudentDirectory();
    renderStaffQuestions();
  });
  els.studentDirectory.appendChild(allButton);

  visibleStudents().forEach((student) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `student-card ${state.selectedStudentUid === student.uid ? "active" : ""}`;
    const waiting = Number(student.counts?.waiting_teacher || 0);
    button.innerHTML = `
      <strong>${escapeText(student.name)} · ${escapeText(student.student_id || "-")}</strong>
      <span>${campusLabel(student.campus)} · 질문 ${Number(student.counts?.total_questions || 0)} · 답변대기 ${waiting}</span>
    `;
    button.addEventListener("click", () => {
      state.selectedStudentUid = student.uid;
      renderStudentDirectory();
      renderStaffQuestions();
    });
    els.studentDirectory.appendChild(button);
  });
}

function filteredStaffQuestions() {
  const subject = els.subjectFilter.value;
  const status = els.statusFilter.value;
  return state.questions.filter((question) => {
    if (state.selectedStudentUid && question.student_uid !== state.selectedStudentUid) return false;
    if (subject !== "all" && question.subject !== subject) return false;
    if (status !== "all" && question.status !== status) return false;
    return true;
  });
}

function renderStaffQuestions() {
  const rows = filteredStaffQuestions();
  els.staffQuestionList.innerHTML = "";
  const student = state.students.find((row) => row.uid === state.selectedStudentUid);
  els.staffQuestionTitle.textContent = student
    ? `${student.name} ${student.student_id || ""} 질문`
    : "전체 학생 질문";
  setBadge(els.staffQuestionCount, `${rows.length}건`, "neutral");
  if (!rows.length) {
    els.staffQuestionList.innerHTML = '<div class="empty">조건에 맞는 질문이 없습니다.</div>';
    return;
  }
  rows.forEach((question) => els.staffQuestionList.appendChild(questionCard(question, "staff")));
}

async function openThread(questionId) {
  state.selectedQuestionId = questionId;
  setStatus("질문 대화를 불러오는 중입니다.");
  const data = await api(`/api/questions/${encodeURIComponent(questionId)}/messages`);
  revokeObjectUrls();
  renderThread(data.question, data.messages || []);
  els.threadPanel.classList.remove("hidden");
  els.threadPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("질문 대화를 불러왔습니다.", "success");
}

function renderThread(question, messages) {
  els.threadTitle.textContent = `${question.student_name} · ${question.subject}`;
  els.threadMeta.textContent = `${question.student_id} · ${campusLabel(question.campus)} · ${statusLabel(question.status)} · 등록 ${formatDate(question.created_at)}`;
  els.messageList.innerHTML = "";

  messages.forEach((message) => {
    const item = document.createElement("article");
    item.className = `message ${message.author_role}`;
    const head = document.createElement("div");
    head.className = "message-head";
    head.textContent = `${message.author_role === "student" ? "학생" : message.author_role === "master" ? "마스터" : "교사"} · ${formatDate(message.created_at)}`;
    const body = document.createElement("p");
    body.textContent = message.body || "";
    item.append(head, body);

    if (message.attachments?.length) {
      const attachments = document.createElement("div");
      attachments.className = "attachment-row";
      message.attachments.forEach((attachment) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "attachment-button";
        button.textContent = `사진 보기 · ${attachment.original_name} · ${bytesLabel(Number(attachment.size_bytes || 0))}`;
        button.addEventListener("click", () => openAttachment(attachment));
        attachments.appendChild(button);
      });
      item.appendChild(attachments);
    }
    els.messageList.appendChild(item);
  });

  const profile = state.me.profile;
  const isStaff = ["teacher", "master"].includes(profile.role);
  const closed = question.status === "closed";
  els.replyForm.classList.toggle("hidden", closed);
  els.closeQuestionBtn.classList.toggle("hidden", !isStaff || closed);
  els.reopenQuestionBtn.classList.toggle("hidden", !isStaff || !closed);
}

async function openAttachment(attachment) {
  setStatus("비공개 R2 사진을 불러오는 중입니다.");
  const blob = await api(`/api/attachments/${encodeURIComponent(attachment.id)}`, {
    responseType: "blob"
  });
  const url = URL.createObjectURL(blob);
  state.objectUrls.push(url);
  els.imageModalImage.src = url;
  els.imageModalCaption.textContent = attachment.original_name || "첨부 사진";
  els.imageModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  setStatus("사진을 불러왔습니다.", "success");
}

function closeImageModal() {
  els.imageModal.classList.add("hidden");
  els.imageModalImage.removeAttribute("src");
  document.body.classList.remove("modal-open");
}

async function loadStudentAdmin() {
  const profile = state.me.profile;
  const tasks = [loadStudents()];
  if (profile.role === "master" || profile.can_approve_students === 1) {
    tasks.push(api("/api/admin/student-applications").then((data) => {
      renderStudentApplications(data.applications || []);
    }));
  } else {
    els.studentApplicationList.innerHTML = '<div class="empty">학생 승인 권한이 없습니다.</div>';
  }
  await Promise.all(tasks);
  renderStudentManagement();
}

function renderStudentApplications(applications) {
  els.studentApplicationList.innerHTML = "";
  const pending = applications.filter((row) => row.status !== "approved");
  if (!pending.length) {
    els.studentApplicationList.innerHTML = '<div class="empty">처리할 학생 가입 요청이 없습니다.</div>';
    return;
  }

  pending.forEach((application) => {
    const card = document.createElement("article");
    card.className = "admin-card";
    card.innerHTML = `
      <div><strong>${escapeText(application.name)}</strong><span>${escapeText(application.email)}</span></div>
      <div class="meta">${campusLabel(application.campus)} · 연락처 뒤 ${escapeText(application.contact_last4)} · ${applicationStatusLabel(application.status)}</div>
    `;
    const form = document.createElement("form");
    form.className = "admin-inline-form";
    const input = document.createElement("input");
    input.placeholder = application.campus === "suseong1" ? "M001" : "S001";
    input.maxLength = 4;
    input.required = true;
    const approve = document.createElement("button");
    approve.className = "button student small";
    approve.type = "submit";
    approve.textContent = "승인";
    const reject = document.createElement("button");
    reject.className = "button danger small";
    reject.type = "button";
    reject.textContent = "반려";
    form.append(input, approve, reject);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api(`/api/admin/student-applications/${encodeURIComponent(application.uid)}/approve`, {
        method: "POST",
        jsonBody: { studentId: input.value.trim().toUpperCase() }
      });
      setStatus(`${application.name} 학생을 승인했습니다.`, "success");
      await loadStudentAdmin();
    });
    reject.addEventListener("click", async () => {
      const reason = prompt("반려 사유를 입력하세요.", "") ?? "";
      await api(`/api/admin/student-applications/${encodeURIComponent(application.uid)}/reject`, {
        method: "POST",
        jsonBody: { reason }
      });
      setStatus(`${application.name} 학생 신청을 반려했습니다.`, "success");
      await loadStudentAdmin();
    });
    card.appendChild(form);
    els.studentApplicationList.appendChild(card);
  });
}

function renderStudentManagement() {
  els.studentManagementList.innerHTML = "";
  const canManage = state.me.profile.role === "master" || state.me.profile.can_manage_student_info === 1;
  if (!state.students.length) {
    els.studentManagementList.innerHTML = '<div class="empty">승인 학생이 없습니다.</div>';
    return;
  }
  state.students.forEach((student) => {
    const card = document.createElement("article");
    card.className = "admin-card";
    const header = document.createElement("div");
    header.innerHTML = `<strong>${escapeText(student.name)}</strong><span>${escapeText(student.email)}</span>`;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${campusLabel(student.campus)} · ${student.student_id || "-"} · ${student.active === 1 ? "활성" : "중지"}`;
    card.append(header, meta);
    if (canManage) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button secondary small";
      button.textContent = "학생정보 수정";
      button.addEventListener("click", async () => {
        const name = prompt("학생 이름", student.name) ?? student.name;
        const campus = prompt("소속관: suseong1 또는 suseong2", student.campus) ?? student.campus;
        const studentId = prompt("내부 학생번호", student.student_id || "") ?? student.student_id;
        const activeText = prompt("활성 상태: 1 활성 / 0 중지", String(student.active)) ?? String(student.active);
        await api(`/api/admin/students/${encodeURIComponent(student.uid)}/update`, {
          method: "POST",
          jsonBody: { name, campus, studentId, active: activeText === "1" }
        });
        setStatus(`${name} 학생정보를 수정했습니다.`, "success");
        await loadStudentAdmin();
        await loadQuestions();
      });
      card.appendChild(button);
    }
    els.studentManagementList.appendChild(card);
  });
}

async function loadMasterAdmin() {
  const [requests, teachers] = await Promise.all([
    api("/api/admin/teacher-requests"),
    api("/api/admin/teachers")
  ]);
  renderTeacherRequests(requests.requests || []);
  renderTeacherManagement(teachers.teachers || []);
}

function permissionForm(prefix, initial = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "permission-form";
  wrapper.innerHTML = `
    <label><input type="checkbox" data-field="suseong1" ${initial.campuses?.includes("suseong1") ? "checked" : ""}> 수성1관</label>
    <label><input type="checkbox" data-field="suseong2" ${initial.campuses?.includes("suseong2") ? "checked" : ""}> 수성2관</label>
    <label><input type="checkbox" data-field="answer" ${initial.answer ? "checked" : ""}> 질문 답변</label>
    <label><input type="checkbox" data-field="approve" ${initial.approve ? "checked" : ""}> 학생 승인</label>
    <label><input type="checkbox" data-field="manage" ${initial.manage ? "checked" : ""}> 학생정보 관리</label>
    ${prefix === "teacher" ? `<label><input type="checkbox" data-field="active" ${initial.active ? "checked" : ""}> 계정 활성</label>` : ""}
  `;
  return wrapper;
}

function permissionValues(wrapper) {
  const checked = (field) => wrapper.querySelector(`[data-field="${field}"]`)?.checked === true;
  return {
    campuses: ["suseong1", "suseong2"].filter(checked),
    canAnswerQuestions: checked("answer"),
    canApproveStudents: checked("approve"),
    canManageStudentInfo: checked("manage"),
    active: checked("active")
  };
}

function renderTeacherRequests(requests) {
  els.teacherRequestList.innerHTML = "";
  const pending = requests.filter((row) => row.status !== "approved");
  if (!pending.length) {
    els.teacherRequestList.innerHTML = '<div class="empty">처리할 교사 권한 요청이 없습니다.</div>';
    return;
  }
  pending.forEach((request) => {
    const card = document.createElement("article");
    card.className = "admin-card";
    card.innerHTML = `
      <div><strong>${escapeText(request.name)}</strong><span>${escapeText(request.email)}</span></div>
      <div class="meta">${applicationStatusLabel(request.status)} · 요청 ${formatDate(request.requested_at)}</div>
    `;
    const permissions = permissionForm("request", { answer: true });
    const actions = document.createElement("div");
    actions.className = "button-row compact";
    const approve = document.createElement("button");
    approve.className = "button primary small";
    approve.type = "button";
    approve.textContent = "교사 승인";
    const reject = document.createElement("button");
    reject.className = "button danger small";
    reject.type = "button";
    reject.textContent = "반려";
    actions.append(approve, reject);
    approve.addEventListener("click", async () => {
      await api(`/api/admin/teacher-requests/${encodeURIComponent(request.uid)}/approve`, {
        method: "POST",
        jsonBody: permissionValues(permissions)
      });
      setStatus(`${request.name} 교사를 승인했습니다.`, "success");
      await loadMasterAdmin();
    });
    reject.addEventListener("click", async () => {
      const reason = prompt("반려 사유를 입력하세요.", "") ?? "";
      await api(`/api/admin/teacher-requests/${encodeURIComponent(request.uid)}/reject`, {
        method: "POST",
        jsonBody: { reason }
      });
      setStatus(`${request.name} 교사 요청을 반려했습니다.`, "success");
      await loadMasterAdmin();
    });
    card.append(permissions, actions);
    els.teacherRequestList.appendChild(card);
  });
}

function renderTeacherManagement(teachers) {
  els.teacherManagementList.innerHTML = "";
  if (!teachers.length) {
    els.teacherManagementList.innerHTML = '<div class="empty">승인 교사가 없습니다.</div>';
    return;
  }
  teachers.forEach((teacher) => {
    const card = document.createElement("article");
    card.className = "admin-card";
    card.innerHTML = `
      <div><strong>${escapeText(teacher.name)}</strong><span>${escapeText(teacher.email)}</span></div>
      <div class="meta">${teacher.active === 1 ? "활성" : "중지"} · ${(teacher.campuses || []).map(campusLabel).join(" · ") || "관리 관 없음"}</div>
    `;
    const permissions = permissionForm("teacher", {
      campuses: teacher.campuses || [],
      answer: teacher.can_answer_questions === 1,
      approve: teacher.can_approve_students === 1,
      manage: teacher.can_manage_student_info === 1,
      active: teacher.active === 1
    });
    const save = document.createElement("button");
    save.type = "button";
    save.className = "button primary small";
    save.textContent = "권한 저장";
    save.addEventListener("click", async () => {
      const name = prompt("교사 이름", teacher.name) ?? teacher.name;
      await api(`/api/admin/teachers/${encodeURIComponent(teacher.uid)}/update`, {
        method: "POST",
        jsonBody: { name, ...permissionValues(permissions) }
      });
      setStatus(`${name} 교사 권한을 수정했습니다.`, "success");
      await loadMasterAdmin();
      await loadAccountView();
    });
    card.append(permissions, save);
    els.teacherManagementList.appendChild(card);
  });
}

$("staffLoginBtn").addEventListener("click", () => login("staff", $("staffLoginBtn")));
$("studentSignupBtn").addEventListener("click", () => login("studentSignup", $("studentSignupBtn")));
$("studentLoginBtn").addEventListener("click", () => login("studentLogin", $("studentLoginBtn")));
$("switchAccountBtn").addEventListener("click", () => login(
  sessionStorage.getItem(AUTH_INTENT_KEY) || "staff",
  $("switchAccountBtn")
));
$("refreshBtn").addEventListener("click", async () => {
  try {
    await getToken(true);
    await loadAccountView();
  } catch (error) {
    setStatus(error.message, "error");
  }
});
$("logoutBtn").addEventListener("click", async () => {
  sessionStorage.removeItem(AUTH_INTENT_KEY);
  await signOut(auth);
});

els.studentApplicationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await api("/api/student-applications", {
      method: "POST",
      jsonBody: {
        campus: els.studentApplicationCampus.value,
        name: els.studentApplicationName.value.trim(),
        contactLast4: els.studentApplicationContact.value.trim()
      }
    });
    setStatus(`${campusLabel(data.campus)} 학생 가입 요청이 저장됐습니다.`, "success");
    await loadAccountView();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

els.teacherRequestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/teacher-requests", {
      method: "POST",
      jsonBody: { name: els.teacherRequestName.value.trim() }
    });
    setStatus("교사 권한 요청이 저장됐습니다.", "success");
    await loadAccountView();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

els.questionImages.addEventListener("change", () =>
  prepareFiles(els.questionImages, "questionFiles", els.questionImagePreview)
);
els.replyImages.addEventListener("change", () =>
  prepareFiles(els.replyImages, "replyFiles", els.replyImagePreview)
);

els.questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.questionSubmitBtn.disabled = true;
  try {
    const form = new FormData();
    form.append("subject", els.questionSubject.value);
    form.append("text", els.questionText.value.trim());
    state.questionFiles.forEach((file) => form.append("images", file, file.name));
    await api("/api/questions", { method: "POST", formData: form });
    els.questionForm.reset();
    state.questionFiles = [];
    els.questionImagePreview.innerHTML = "";
    setStatus("질문이 D1에 등록되고 사진은 비공개 R2에 저장됐습니다.", "success");
    await loadQuestions();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    els.questionSubmitBtn.disabled = false;
  }
});

els.replyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedQuestionId) return;
  els.replySubmitBtn.disabled = true;
  try {
    const form = new FormData();
    form.append("text", els.replyText.value.trim());
    state.replyFiles.forEach((file) => form.append("images", file, file.name));
    await api(`/api/questions/${encodeURIComponent(state.selectedQuestionId)}/messages`, {
      method: "POST",
      formData: form
    });
    els.replyForm.reset();
    state.replyFiles = [];
    els.replyImagePreview.innerHTML = "";
    setStatus("메시지와 첨부 사진을 전송했습니다.", "success");
    await Promise.all([loadQuestions(), openThread(state.selectedQuestionId)]);
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    els.replySubmitBtn.disabled = false;
  }
});

els.closeQuestionBtn.addEventListener("click", async () => {
  if (!state.selectedQuestionId || !confirm("이 질문을 종료하시겠습니까?")) return;
  try {
    await api(`/api/questions/${encodeURIComponent(state.selectedQuestionId)}/close`, {
      method: "POST",
      jsonBody: {}
    });
    setStatus("질문을 종료했습니다.", "success");
    await Promise.all([loadQuestions(), openThread(state.selectedQuestionId)]);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

els.reopenQuestionBtn.addEventListener("click", async () => {
  if (!state.selectedQuestionId) return;
  try {
    await api(`/api/questions/${encodeURIComponent(state.selectedQuestionId)}/reopen`, {
      method: "POST",
      jsonBody: {}
    });
    setStatus("질문을 다시 열었습니다.", "success");
    await Promise.all([loadQuestions(), openThread(state.selectedQuestionId)]);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

els.closeThreadBtn.addEventListener("click", () => {
  state.selectedQuestionId = null;
  els.threadPanel.classList.add("hidden");
  revokeObjectUrls();
});

els.studentSearch.addEventListener("input", renderStudentDirectory);
els.subjectFilter.addEventListener("change", renderStaffQuestions);
els.statusFilter.addEventListener("change", renderStaffQuestions);
$("reloadStudentAdminBtn").addEventListener("click", () => loadStudentAdmin().catch((error) => setStatus(error.message, "error")));
$("reloadMasterAdminBtn").addEventListener("click", () => loadMasterAdmin().catch((error) => setStatus(error.message, "error")));
$("imageModalClose").addEventListener("click", closeImageModal);
els.imageModal.addEventListener("click", (event) => {
  if (event.target === els.imageModal) closeImageModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeImageModal();
});

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  resetData();
  if (!user) {
    els.loginArea.classList.remove("hidden");
    els.accountBar.classList.add("hidden");
    hideAllPanels();
    setStatus("로그인하지 않았습니다. 학생·교사·마스터 모두 Google 로그인을 사용합니다.");
    return;
  }

  els.loginArea.classList.add("hidden");
  els.accountBar.classList.remove("hidden");
  try {
    await loadAccountView();
  } catch (error) {
    console.error(error);
    setStatus(`통합 질문 시스템을 불러오지 못했습니다.\n${error.message}`, "error");
  }
});
