import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  deleteObject, getBlob, ref as storageRef, uploadBytes
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
import { auth, authPersistenceReady, db, storage } from "../question-access/firebase-client.js";

const MAX_IMAGE_BYTES = 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const $ = (id) => document.getElementById(id);

let profile = null;
let user = null;
let tab = new URLSearchParams(location.search).get("tab") === "schedule" ? "schedule" : "notice";
let notices = [];
let schedules = [];
let previewObjectUrl = "";
const renderedObjectUrls = new Set();

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
    const current = select.value;
    select.innerHTML = "";
    staffCampuses().forEach((campus) => {
      const option = document.createElement("option");
      option.value = campus;
      option.textContent = campusName(campus);
      select.appendChild(option);
    });
    if ([...select.options].some((option) => option.value === current)) select.value = current;
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

function appendLinkedText(container, value) {
  const text = String(value ?? "");
  const pattern = /(https?:\/\/[^\s<>"']+)/gi;
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) container.append(document.createTextNode(text.slice(lastIndex, match.index)));
    let urlText = match[0];
    let trailing = "";
    while (/[.,!?;:)}\]]$/.test(urlText)) {
      trailing = urlText.slice(-1) + trailing;
      urlText = urlText.slice(0, -1);
    }
    try {
      const url = new URL(urlText);
      if (url.protocol === "http:" || url.protocol === "https:") {
        const link = document.createElement("a");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = urlText;
        container.append(link);
      } else {
        container.append(document.createTextNode(urlText));
      }
    } catch {
      container.append(document.createTextNode(urlText));
    }
    if (trailing) container.append(document.createTextNode(trailing));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) container.append(document.createTextNode(text.slice(lastIndex)));
}

function normalizeUrl(value) {
  const input = String(value ?? "").trim();
  if (!input) return "";
  const parsed = new URL(input);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("관련 주소는 http:// 또는 https:// 주소만 사용할 수 있습니다.");
  return parsed.href;
}

function clearRenderedObjectUrls() {
  renderedObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  renderedObjectUrls.clear();
}

async function attachStoredImage(container, row) {
  if (!row.imagePath) return;
  const wrap = document.createElement("div");
  wrap.className = "notice-image-wrap";
  const loading = document.createElement("div");
  loading.className = "image-loading";
  loading.textContent = "공지 사진을 불러오는 중입니다.";
  wrap.appendChild(loading);
  container.appendChild(wrap);
  try {
    const blob = await getBlob(storageRef(storage, row.imagePath), MAX_IMAGE_BYTES + 1);
    const objectUrl = URL.createObjectURL(blob);
    renderedObjectUrls.add(objectUrl);
    const image = document.createElement("img");
    image.className = "notice-image";
    image.src = objectUrl;
    image.alt = `${row.title || "학원공지"} 첨부 사진`;
    image.loading = "lazy";
    wrap.replaceChildren(image);
  } catch (error) {
    loading.textContent = `사진을 불러오지 못했습니다. ${error.code || ""}`.trim();
  }
}

function renderNotices() {
  clearRenderedObjectUrls();
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
          ${row.imagePath ? '<span class="tag">사진</span>' : ""}
          <span class="tag ${row.visible ? "" : "hidden-tag"}">${row.visible ? "학생 공개" : "비공개"}</span>
        </div>
      </div>`;

    const content = document.createElement("div");
    content.className = "content";
    appendLinkedText(content, row.content);
    article.appendChild(content);

    if (row.relatedUrl) {
      const link = document.createElement("a");
      link.className = "notice-link";
      link.href = row.relatedUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "관련 페이지 열기 ↗";
      article.appendChild(link);
    }

    void attachStoredImage(article, row);

    if (isStaff() && canManageCampus(row.campus)) {
      const actions = document.createElement("div");
      actions.className = "admin-actions";
      actions.innerHTML = '<button class="edit">수정</button><button class="delete">삭제</button>';
      actions.children[0].addEventListener("click", () => editNotice(row));
      actions.children[1].addEventListener("click", () => removeRecord("academyNotices", row));
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
      actions.children[1].addEventListener("click", () => removeRecord("examSchedules", row));
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

function revokePreviewUrl() {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = "";
}

function hideImagePreview() {
  revokePreviewUrl();
  $("noticeImagePreview").replaceChildren();
  $("noticeImagePreview").classList.add("hidden");
}

function showPreviewUrl(url, label) {
  const preview = $("noticeImagePreview");
  preview.replaceChildren();
  const image = document.createElement("img");
  image.src = url;
  image.alt = "공지 사진 미리보기";
  const meta = document.createElement("div");
  meta.className = "image-preview-meta";
  meta.textContent = label;
  preview.append(image, meta);
  preview.classList.remove("hidden");
}

function validateImageFile(file) {
  if (!file) return;
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!IMAGE_TYPES.has(file.type) || !IMAGE_EXTENSIONS.has(extension)) {
    throw new Error("JPG·PNG·WebP 사진만 업로드할 수 있습니다. 일반 파일 업로드는 금지됩니다.");
  }
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    throw new Error("공지 사진은 1MB 이하여야 합니다.");
  }
}

function previewSelectedFile(file) {
  validateImageFile(file);
  revokePreviewUrl();
  previewObjectUrl = URL.createObjectURL(file);
  showPreviewUrl(previewObjectUrl, `${file.name} · ${(file.size / 1024).toFixed(1)}KB`);
  $("noticeImageRemoveButton").classList.remove("hidden");
  $("noticeRemoveImage").value = "0";
}

async function previewStoredImage(path, name, size) {
  if (!path) {
    hideImagePreview();
    return;
  }
  try {
    const blob = await getBlob(storageRef(storage, path), MAX_IMAGE_BYTES + 1);
    revokePreviewUrl();
    previewObjectUrl = URL.createObjectURL(blob);
    showPreviewUrl(previewObjectUrl, `${name || "현재 공지 사진"}${size ? ` · ${(Number(size) / 1024).toFixed(1)}KB` : ""}`);
    $("noticeImageRemoveButton").classList.remove("hidden");
  } catch (error) {
    hideImagePreview();
    status(`기존 공지 사진을 불러오지 못했습니다.\n${error.message || String(error)}`, "warning");
  }
}

function resetNotice() {
  $("noticeForm").reset();
  $("noticeId").value = "";
  $("noticeOriginalCampus").value = "";
  $("noticeImagePath").value = "";
  $("noticeRemoveImage").value = "0";
  $("noticeVisible").checked = true;
  $("noticeImageRemoveButton").classList.add("hidden");
  hideImagePreview();
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
  $("noticeOriginalCampus").value = row.campus;
  $("noticeCampus").value = row.campus;
  $("noticeTitle").value = row.title;
  $("noticeContent").value = row.content;
  $("noticeUrl").value = row.relatedUrl || "";
  $("noticeImagePath").value = row.imagePath || "";
  $("noticeRemoveImage").value = "0";
  $("noticeImage").value = "";
  $("noticePinned").checked = Boolean(row.pinned);
  $("noticeVisible").checked = Boolean(row.visible);
  if (row.imagePath) void previewStoredImage(row.imagePath, row.imageName, row.imageSize);
  else {
    hideImagePreview();
    $("noticeImageRemoveButton").classList.add("hidden");
  }
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

async function removeStorageImage(path) {
  if (!path) return;
  try {
    await deleteObject(storageRef(storage, path));
  } catch (error) {
    if (error.code !== "storage/object-not-found") throw error;
  }
}

async function removeRecord(collectionName, row) {
  if (!confirm("이 자료를 삭제할까요?")) return;
  try {
    await deleteDoc(doc(db, collectionName, row.id));
    if (collectionName === "academyNotices" && row.imagePath) {
      try {
        await removeStorageImage(row.imagePath);
      } catch (imageError) {
        status(`공지는 삭제했지만 사진 원본 정리가 필요합니다.\n${imageError.message}`, "warning");
      }
    }
    await load();
  } catch (error) {
    status(`삭제하지 못했습니다.\n${error.message}`, "error");
  }
}

function extensionForType(contentType) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}

async function uploadNoticeImage(file, campus, noticeId) {
  validateImageFile(file);
  const path = `academy-notices/v1/${campus}/${noticeId}/${crypto.randomUUID()}.${extensionForType(file.type)}`;
  await uploadBytes(storageRef(storage, path), file, {
    contentType: file.type,
    customMetadata: {
      noticeId,
      campus,
      uploaderUid: user.uid
    }
  });
  return {
    imagePath: path,
    imageName: file.name.slice(0, 160),
    imageType: file.type,
    imageSize: file.size
  };
}

$("noticeImage").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    previewSelectedFile(file);
    status("공지 사진이 선택되었습니다. 공지 저장을 누르면 클라우드에 업로드됩니다.", "success");
  } catch (error) {
    event.target.value = "";
    hideImagePreview();
    $("noticeImageRemoveButton").classList.add("hidden");
    status(error.message || String(error), "error");
  }
});

$("noticeImageRemoveButton").addEventListener("click", () => {
  $("noticeImage").value = "";
  $("noticeRemoveImage").value = "1";
  hideImagePreview();
  $("noticeImageRemoveButton").classList.add("hidden");
  status("현재 공지 사진을 삭제하도록 표시했습니다. 공지 저장을 눌러 확정하세요.", "warning");
});

$("noticeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const saveButton = $("noticeSaveButton");
  const existingId = $("noticeId").value;
  const noticeReference = existingId ? doc(db, "academyNotices", existingId) : doc(collection(db, "academyNotices"));
  const existing = existingId ? notices.find((row) => row.id === existingId) : null;
  const campus = $("noticeCampus").value;
  const selectedFile = $("noticeImage").files?.[0] || null;
  const removeImage = $("noticeRemoveImage").value === "1";
  const oldImagePath = existing?.imagePath || "";
  let uploaded = null;

  saveButton.disabled = true;
  status("학원공지를 저장하는 중입니다.");
  try {
    const relatedUrl = normalizeUrl($("noticeUrl").value);
    if (selectedFile) validateImageFile(selectedFile);
    if (oldImagePath && existing?.campus !== campus && !selectedFile && !removeImage) {
      throw new Error("사진이 있는 공지의 대상관을 변경하려면 사진을 다시 선택하거나 기존 사진을 삭제해야 합니다.");
    }

    if (selectedFile) uploaded = await uploadNoticeImage(selectedFile, campus, noticeReference.id);
    const imageData = uploaded || (removeImage
      ? { imagePath: "", imageName: "", imageType: "", imageSize: 0 }
      : {
          imagePath: existing?.imagePath || "",
          imageName: existing?.imageName || "",
          imageType: existing?.imageType || "",
          imageSize: Number(existing?.imageSize || 0)
        });

    const data = {
      campus,
      title: $("noticeTitle").value.trim(),
      content: $("noticeContent").value.trim(),
      relatedUrl,
      ...imageData,
      pinned: $("noticePinned").checked,
      visible: $("noticeVisible").checked,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
      updatedByName: user.displayName || profile.name || ""
    };

    if (existingId) {
      await updateDoc(noticeReference, data);
    } else {
      await setDoc(noticeReference, {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByName: user.displayName || profile.name || ""
      });
    }

    if (oldImagePath && (removeImage || uploaded) && oldImagePath !== uploaded?.imagePath) {
      try {
        await removeStorageImage(oldImagePath);
      } catch (imageError) {
        status(`공지는 저장했지만 이전 사진 정리가 필요합니다.\n${imageError.message}`, "warning");
      }
    }

    resetNotice();
    status("학원공지가 저장되었습니다.", "success");
    await load();
  } catch (error) {
    if (uploaded?.imagePath) {
      try { await removeStorageImage(uploaded.imagePath); } catch { /* cleanup best effort */ }
    }
    status(`공지를 저장하지 못했습니다.\n${error.message || String(error)}`, "error");
  } finally {
    saveButton.disabled = false;
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
      const scheduleReference = doc(collection(db, "examSchedules"));
      await setDoc(scheduleReference, {
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

window.addEventListener("dragover", (event) => {
  if ([...(event.dataTransfer?.types || [])].includes("Files")) event.preventDefault();
});
window.addEventListener("drop", (event) => {
  if ((event.dataTransfer?.files?.length || 0) > 0) {
    event.preventDefault();
    status("끌어놓기 파일 업로드는 지원하지 않습니다. 공지 사진 선택창에서 JPG·PNG·WebP 사진 1장만 선택하세요.", "warning");
  }
});
window.addEventListener("beforeunload", () => {
  revokePreviewUrl();
  clearRenderedObjectUrls();
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
