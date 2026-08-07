import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  deleteObject,
  ref as storageRef
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
import { auth, db, storage } from "../question-access/firebase-client.js";

const API_BASE = "https://etoos247-qa-api.etoos247test.workers.dev";
const managerId = "masterNoticePhotoManager";

function getImages(row) {
  if (Array.isArray(row?.images)) {
    return row.images
      .filter((item) => item?.path)
      .slice(0, 3)
      .map((item) => ({
        path: String(item.path),
        name: String(item.name || "공지 사진"),
        type: String(item.type || ""),
        size: Number(item.size || 0)
      }));
  }
  if (row?.imagePath) {
    return [{
      path: String(row.imagePath),
      name: String(row.imageName || "공지 사진"),
      type: String(row.imageType || ""),
      size: Number(row.imageSize || 0)
    }];
  }
  return [];
}

async function isQaMaster(user) {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!response.ok) return false;
  const data = await response.json();
  return data.profile?.role === "master" && data.profile?.active === 1;
}

function ensureStyles() {
  if (document.getElementById("masterPhotoManagerStyles")) return;
  const style = document.createElement("style");
  style.id = "masterPhotoManagerStyles";
  style.textContent = `
    .master-photo-manager{margin-top:18px;padding:18px;border:1px solid #fecaca;border-radius:16px;background:#fff7f7}
    .master-photo-manager h2{margin:0 0 6px}
    .master-photo-manager p{margin:0;color:#7f1d1d;font-size:12px;line-height:1.6}
    .master-photo-list{display:grid;gap:10px;margin-top:14px}
    .master-photo-card{padding:12px;border:1px solid #f3c4c4;border-radius:12px;background:#fff}
    .master-photo-card strong{display:block}
    .master-photo-meta{margin-top:5px;color:#64748b;font-size:11px;line-height:1.5;overflow-wrap:anywhere}
    .master-photo-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
    .master-photo-actions button{min-height:34px;border:0;border-radius:8px;padding:7px 10px;background:#fee2e2;color:#b91c1c;font-weight:850;cursor:pointer}
    .master-photo-reload{margin-top:12px;min-height:38px;border:0;border-radius:9px;padding:8px 12px;background:#0f766e;color:#fff;font-weight:850;cursor:pointer}
  `;
  document.head.appendChild(style);
}

function ensurePanel() {
  if (document.getElementById(managerId)) return document.getElementById(managerId);
  ensureStyles();
  const host = document.querySelector(".shell");
  const panel = document.createElement("section");
  panel.id = managerId;
  panel.className = "master-photo-manager hidden";
  panel.innerHTML = `
    <h2>마스터 공지 사진 관리</h2>
    <p>공지 글은 유지하고 선택한 사진 원본과 사진 연결정보만 즉시 삭제합니다.</p>
    <button id="reloadMasterNoticePhotos" class="master-photo-reload" type="button">공지 사진 목록 새로고침</button>
    <div id="masterNoticePhotoList" class="master-photo-list"></div>
  `;
  host.appendChild(panel);
  document.getElementById("reloadMasterNoticePhotos").addEventListener("click", loadPhotos);
  return panel;
}

async function removeStorage(path) {
  try {
    await deleteObject(storageRef(storage, path));
  } catch (error) {
    if (error.code !== "storage/object-not-found") throw error;
  }
}

async function deleteOnePhoto(notice, image) {
  const title = notice.title || "학원공지";
  if (!confirm(`'${title}'의 '${image.name}' 사진만 삭제할까요?`)) return;

  const images = getImages(notice);
  const remaining = images.filter((item) => item.path !== image.path);
  const first = remaining[0] || null;

  await removeStorage(image.path);
  await updateDoc(doc(db, "academyNotices", notice.id), {
    images: remaining,
    imagePath: first?.path || "",
    imageName: first?.name || "",
    imageType: first?.type || "",
    imageSize: first?.size || 0,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
    updatedByName: auth.currentUser.displayName || "마스터"
  });

  await loadPhotos();
  setTimeout(() => location.reload(), 350);
}

async function deleteAllPhotos(notice) {
  const images = getImages(notice);
  if (!images.length) return;
  if (!confirm(`'${notice.title || "학원공지"}'의 사진 ${images.length}장을 모두 삭제할까요?`)) return;

  await Promise.allSettled(images.map((image) => removeStorage(image.path)));
  await updateDoc(doc(db, "academyNotices", notice.id), {
    images: [],
    imagePath: "",
    imageName: "",
    imageType: "",
    imageSize: 0,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
    updatedByName: auth.currentUser.displayName || "마스터"
  });

  await loadPhotos();
  setTimeout(() => location.reload(), 350);
}

async function loadPhotos() {
  const list = document.getElementById("masterNoticePhotoList");
  if (!list) return;
  list.innerHTML = "공지 사진을 불러오는 중입니다.";

  try {
    const snapshot = await getDocs(collection(db, "academyNotices"));
    const notices = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((row) => getImages(row).length > 0)
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ko"));

    list.innerHTML = "";
    if (!notices.length) {
      list.innerHTML = '<div class="empty">삭제할 공지 사진이 없습니다.</div>';
      return;
    }

    notices.forEach((notice) => {
      const images = getImages(notice);
      const card = document.createElement("article");
      card.className = "master-photo-card";
      card.innerHTML = `
        <strong>${notice.title || "제목 없음"}</strong>
        <div class="master-photo-meta">사진 ${images.length}장 · ${notice.campus || "all"}</div>
        <div class="master-photo-actions"></div>
      `;
      const actions = card.querySelector(".master-photo-actions");
      images.forEach((image, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `사진 ${index + 1} 삭제 · ${image.name}`;
        button.addEventListener("click", () => deleteOnePhoto(notice, image).catch((error) => alert(error.message)));
        actions.appendChild(button);
      });
      const all = document.createElement("button");
      all.type = "button";
      all.textContent = "이 공지 사진 전체 삭제";
      all.addEventListener("click", () => deleteAllPhotos(notice).catch((error) => alert(error.message)));
      actions.appendChild(all);
      list.appendChild(card);
    });
  } catch (error) {
    list.textContent = `공지 사진 목록을 불러오지 못했습니다. ${error.message}`;
  }
}

ensurePanel();

onAuthStateChanged(auth, async (user) => {
  const panel = document.getElementById(managerId);
  if (!panel) return;
  panel.classList.add("hidden");
  if (!user) return;

  try {
    const firestoreProfile = await getDoc(doc(db, "users", user.uid));
    const firestoreMaster = firestoreProfile.exists()
      && firestoreProfile.data()?.active === true
      && firestoreProfile.data()?.role === "master";
    const qaMaster = await isQaMaster(user);
    if (firestoreMaster || qaMaster) {
      panel.classList.remove("hidden");
      await loadPhotos();
    }
  } catch (error) {
    console.error("마스터 공지 사진 관리 권한 확인 실패", error);
  }
});
