import { auth, authPersistenceReady, provider } from "../question-access/firebase-client.js";
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

const API_BASE = "https://etoos247-qa-api.etoos247test.workers.dev";
const MAX_IMAGE_BYTES = 1048576;
const MAX_IMAGES = 3;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const $ = (id) => document.getElementById(id);
const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");
const refreshBtn = $("refreshBtn");
const authMessage = $("authMessage");
const userBadge = $("userBadge");
const applicationPanel = $("applicationPanel");
const applicationForm = $("applicationForm");
const questionForm = $("questionForm");
const submitQuestionBtn = $("submitQuestionBtn");
const questionMessage = $("questionMessage");
const questionList = $("questionList");
const galleryInput = $("galleryInput");
const cameraInput = $("cameraInput");
const previewList = $("previewList");

let currentUser = null;
let currentProfile = null;
let selectedFiles = [];
let previewUrls = [];

function setMessage(element, text, type = "") {
  element.textContent = text;
  element.className = `message ${type}`.trim();
}

function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.innerHTML = `<span class="spinner"></span>${label}`;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function statusLabel(status) {
  return ({
    waiting_teacher: "교사 답변 대기",
    waiting_student: "학생 확인·재질문 대기",
    closed: "종료"
  })[status] || status || "상태 없음";
}

function statusClass(status) {
  if (status === "waiting_teacher") return "warn";
  if (status === "waiting_student") return "ok";
  return "";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(date);
}

async function getToken(force = false) {
  if (!auth.currentUser) throw new Error("먼저 Google 로그인을 해야 합니다.");
  return auth.currentUser.getIdToken(force);
}

async function api(path, options = {}) {
  const token = await getToken();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: "no-store" });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) {
    const message = typeof data === "object" ? data.message : data;
    throw new Error(message || `API 요청 실패 (${response.status})`);
  }
  return data;
}

function revokePreviews() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
}

function clearFiles() {
  revokePreviews();
  selectedFiles = [];
  galleryInput.value = "";
  cameraInput.value = "";
  renderFiles();
}

function renderFiles() {
  revokePreviews();
  previewList.innerHTML = "";
  if (!selectedFiles.length) {
    previewList.innerHTML = '<div class="empty">선택된 사진이 없습니다. 사진 없이 글만 질문할 수도 있습니다.</div>';
    return;
  }
  selectedFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    const item = document.createElement("article");
    item.className = "preview";
    const image = document.createElement("img");
    image.src = url;
    image.alt = `첨부 사진 ${index + 1}`;
    const info = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = file.name || `첨부 사진 ${index + 1}`;
    const small = document.createElement("small");
    small.textContent = `${Math.ceil(file.size / 1024)}KB · ${file.type}`;
    info.append(strong, small);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "삭제";
    remove.addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      renderFiles();
    });
    item.append(image, info, remove);
    previewList.append(item);
  });
}

async function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compressImage(file) {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error(`${file.name}: JPG·PNG·WebP 형식만 사용할 수 있습니다.`);
  }
  if (file.size <= MAX_IMAGE_BYTES) return file;
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name}: 원본 사진이 20MB를 넘습니다.`);

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name}: 브라우저에서 열 수 없는 사진입니다. JPG로 변환해 다시 선택하세요.`);
  }

  let width = bitmap.width;
  let height = bitmap.height;
  const maxSide = 1800;
  if (Math.max(width, height) > maxSide) {
    const ratio = maxSide / Math.max(width, height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  let blob = null;
  let quality = 0.88;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = Math.max(480, Math.round(width));
    canvas.height = Math.max(360, Math.round(height));
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await canvasBlob(canvas, "image/webp", quality);
    if (blob && blob.size <= MAX_IMAGE_BYTES) break;
    quality = Math.max(0.48, quality - 0.08);
    width *= 0.88;
    height *= 0.88;
  }
  bitmap.close?.();
  if (!blob || blob.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name}: 1MB 이하로 압축하지 못했습니다. 사진을 잘라내거나 해상도를 낮춰 주세요.`);
  }
  const base = (file.name || "question-image").replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.webp`, { type: "image/webp", lastModified: Date.now() });
}

async function addFiles(fileList) {
  const incoming = [...fileList];
  if (selectedFiles.length + incoming.length > MAX_IMAGES) {
    setMessage(questionMessage, `사진은 한 질문에 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`, "bad");
    return;
  }
  setMessage(questionMessage, "사진을 검사하고 1MB 이하로 압축하는 중입니다...");
  try {
    for (const file of incoming) selectedFiles.push(await compressImage(file));
    renderFiles();
    setMessage(questionMessage, `${selectedFiles.length}장의 사진이 준비됐습니다. 각 사진은 1MB 이하입니다.`, "ok");
  } catch (error) {
    setMessage(questionMessage, error.message, "bad");
  }
}

function showProfile(identity, profile) {
  $("profileEmail").textContent = identity?.email || currentUser?.email || "-";
  $("profileUid").textContent = identity?.uid || currentUser?.uid || "-";
  $("profileRole").textContent = profile?.role || "D1 등록 없음";
  $("profileCampus").textContent = profile?.campus === "suseong1" ? "수성1관" : profile?.campus === "suseong2" ? "수성2관" : "-";
  $("profileStudentId").textContent = profile?.student_id || "-";
}

function applyPermissions(profile) {
  currentProfile = profile || null;
  const isStudent = profile?.role === "student" && profile?.active === 1 && profile?.campus && profile?.student_id;
  questionForm.classList.toggle("hidden", !isStudent);
  applicationPanel.classList.toggle("hidden", Boolean(profile && profile.role !== "pending"));
  submitQuestionBtn.disabled = !isStudent;

  if (!profile) {
    userBadge.textContent = "가입 필요";
    userBadge.className = "badge warn";
    setMessage(authMessage, "Google 로그인은 확인됐지만 D1 사용자 등록이 없습니다. 아래에서 학생 가입을 신청하세요.", "warn");
  } else if (isStudent) {
    userBadge.textContent = "학생 승인 완료";
    userBadge.className = "badge ok";
    setMessage(authMessage, `${profile.name || "학생"} 계정이 승인됐습니다. 질문과 사진을 Cloudflare D1·R2에 등록할 수 있습니다.`, "ok");
  } else if (profile.role === "pending") {
    userBadge.textContent = "승인 대기";
    userBadge.className = "badge warn";
    setMessage(authMessage, "학생 가입 신청이 접수됐거나 D1 사용자 상태가 승인 대기입니다. 마스터 승인과 학생번호 부여 후 질문 등록이 열립니다.", "warn");
  } else {
    userBadge.textContent = profile.role || "접근 제한";
    userBadge.className = "badge";
    setMessage(authMessage, `현재 계정 역할은 ${profile.role || "미등록"}입니다. 이 화면의 새 질문 등록은 승인된 학생 계정만 가능합니다.`, "warn");
  }
}

async function refreshSession() {
  if (!auth.currentUser) return;
  setMessage(authMessage, "Firebase 토큰과 D1 권한을 확인하는 중입니다...");
  const data = await api("/api/me");
  showProfile(data.identity, data.profile);
  applyPermissions(data.profile);
  if (data.profile?.role === "student" && data.profile?.active === 1) await loadQuestions();
  else renderQuestions([]);
}

function renderQuestions(questions) {
  questionList.innerHTML = "";
  if (!questions.length) {
    questionList.innerHTML = '<div class="empty">등록된 질문이 없습니다.</div>';
    return;
  }
  questions.forEach((question) => {
    const item = document.createElement("article");
    item.className = "question-item";
    const head = document.createElement("div");
    head.className = "question-head";
    const title = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = `${question.subject} 질문`;
    const time = document.createElement("small");
    time.textContent = `최근 메시지 ${formatDate(question.last_message_at)}`;
    title.append(strong, time);
    const badge = document.createElement("span");
    badge.className = `badge ${statusClass(question.status)}`.trim();
    badge.textContent = statusLabel(question.status);
    head.append(title, badge);
    const id = document.createElement("div");
    id.className = "question-id";
    id.textContent = question.id;
    item.append(head, id);
    questionList.append(item);
  });
}

async function loadQuestions() {
  try {
    const data = await api("/api/questions");
    renderQuestions(data.questions || []);
  } catch (error) {
    questionList.innerHTML = `<div class="message bad">${error.message}</div>`;
  }
}

loginBtn.addEventListener("click", async () => {
  setBusy(loginBtn, true, "로그인 중");
  try {
    await authPersistenceReady;
    await signInWithPopup(auth, provider);
  } catch (error) {
    setMessage(authMessage, `로그인 실패: ${error.message}`, "bad");
  } finally {
    setBusy(loginBtn, false);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  clearFiles();
});

refreshBtn.addEventListener("click", async () => {
  setBusy(refreshBtn, true, "확인 중");
  try {
    await refreshSession();
  } catch (error) {
    setMessage(authMessage, `상태 확인 실패: ${error.message}`, "bad");
  } finally {
    setBusy(refreshBtn, false);
  }
});

$("galleryButton").addEventListener("click", () => galleryInput.click());
$("cameraButton").addEventListener("click", () => cameraInput.click());
$("clearFilesBtn").addEventListener("click", clearFiles);
galleryInput.addEventListener("change", () => addFiles(galleryInput.files || []));
cameraInput.addEventListener("change", () => addFiles(cameraInput.files || []));

applicationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return setMessage(authMessage, "먼저 Google 로그인을 해야 합니다.", "bad");
  const submit = $("applicationSubmit");
  const payload = {
    campus: $("applicationCampus").value,
    name: $("applicationName").value.trim(),
    contactLast4: $("contactLast4").value.trim()
  };
  if (payload.name.length < 2 || !/^\d{4}$/.test(payload.contactLast4)) {
    return setMessage(authMessage, "학생 이름과 연락처 뒤 4자리를 정확히 입력하세요.", "bad");
  }
  setBusy(submit, true, "신청 저장 중");
  try {
    await api("/api/student-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(authMessage, "학생 가입 신청이 D1에 저장됐습니다. 마스터 승인과 학생번호 부여 후 질문 등록이 열립니다.", "ok");
    await refreshSession();
  } catch (error) {
    setMessage(authMessage, `가입 신청 실패: ${error.message}`, "bad");
  } finally {
    setBusy(submit, false);
  }
});

questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentProfile || currentProfile.role !== "student" || currentProfile.active !== 1) {
    return setMessage(questionMessage, "승인된 학생 계정만 질문을 등록할 수 있습니다.", "bad");
  }
  const text = $("questionText").value.trim();
  if (text.length < 2) return setMessage(questionMessage, "질문 내용을 2자 이상 입력하세요.", "bad");
  const form = new FormData();
  form.append("subject", $("subject").value);
  form.append("text", text);
  selectedFiles.forEach((file) => form.append("images", file, file.name));
  setBusy(submitQuestionBtn, true, "질문 등록 중");
  setMessage(questionMessage, "Firebase 인증을 확인하고 질문은 D1, 사진은 비공개 R2에 저장하는 중입니다...");
  try {
    const result = await api("/api/questions", { method: "POST", body: form });
    setMessage(questionMessage, `질문 등록 완료\n질문 ID: ${result.questionId}\n첨부 사진: ${result.attachments}장`, "ok");
    $("questionText").value = "";
    clearFiles();
    await loadQuestions();
  } catch (error) {
    setMessage(questionMessage, `질문 등록 실패: ${error.message}`, "bad");
  } finally {
    setBusy(submitQuestionBtn, false);
    submitQuestionBtn.disabled = !(currentProfile?.role === "student" && currentProfile?.active === 1);
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  loginBtn.classList.toggle("hidden", Boolean(user));
  logoutBtn.classList.toggle("hidden", !user);
  refreshBtn.classList.toggle("hidden", !user);
  if (!user) {
    currentProfile = null;
    userBadge.textContent = "로그인 전";
    userBadge.className = "badge";
    showProfile(null, null);
    questionForm.classList.add("hidden");
    applicationPanel.classList.add("hidden");
    renderQuestions([]);
    setMessage(authMessage, "Google 로그인 후 Firebase UID와 D1 학생 권한을 확인합니다.");
    return;
  }
  $("applicationName").value = user.displayName || "";
  try {
    await refreshSession();
  } catch (error) {
    setMessage(authMessage, `사용자 상태 확인 실패: ${error.message}`, "bad");
  }
});

renderFiles();
renderQuestions([]);
