import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, authPersistenceReady, db } from "../question-access/firebase-client.js";

let profile = null;
const $ = (id) => document.getElementById(id);

function currentTab() {
  return document.querySelector(".tab.active")?.dataset.tab
    || (new URLSearchParams(location.search).get("tab") === "schedule" ? "schedule" : "notice");
}

function permitted(tab) {
  if (profile?.active !== true) return false;
  if (profile.role === "master") return true;
  if (profile.role !== "teacher") return false;
  return tab === "schedule"
    ? profile.canManageSchedules !== false
    : profile.canManageNotices !== false;
}

function syncEditor() {
  const editor = $("editor");
  if (!editor) return;
  const allowed = permitted(currentTab());
  editor.classList.toggle("hidden", !allowed);

  const noticeAllowed = permitted("notice");
  const scheduleAllowed = permitted("schedule");
  document.querySelectorAll("#noticeView .admin-actions").forEach((node) => node.classList.toggle("hidden", !noticeAllowed));
  document.querySelectorAll("#scheduleView .admin-actions").forEach((node) => node.classList.toggle("hidden", !scheduleAllowed));
}

const observer = new MutationObserver(syncEditor);
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => queueMicrotask(syncEditor)));

await authPersistenceReady;
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    profile = null;
    syncEditor();
    return;
  }
  const snapshot = await getDoc(doc(db, "users", user.uid));
  profile = snapshot.exists() ? snapshot.data() : null;
  syncEditor();
});
