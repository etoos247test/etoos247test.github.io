import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { db } from "./firebase-client.js";
import { els, state, showStatus, timeout } from "./shared.js";

function permissionFieldset(prefix, values = {}) {
  const box = document.createElement("fieldset"); box.className = "permission-box";
  const legend = document.createElement("legend"); legend.textContent = "부여 권한"; box.appendChild(legend);
  [
    ["canAnswerQuestions", "질문 열람·답변", "학생 질문을 열람하고 답변합니다.", values.canAnswerQuestions !== false],
    ["canManageStudentInfo", "학생번호·이름 관리", "학생번호와 이름만 수정합니다.", values.canManageStudentInfo === true],
    ["canResetStudentPassword", "임시 비밀번호 재발급", "보안 서버 함수를 통해 학생 비밀번호를 재발급합니다.", values.canResetStudentPassword === true]
  ].forEach(([key, label, help, checked]) => {
    const row = document.createElement("label"); row.className = "permission-option";
    const input = document.createElement("input"); input.type = "checkbox"; input.id = `${prefix}-${key}`; input.dataset.permission = key; input.checked = checked;
    const text = document.createElement("span"); text.innerHTML = `${label}<span class="permission-help">${help}</span>`;
    row.append(input, text); box.appendChild(row);
  });
  return box;
}
function readPermissions(container) {
  const result = {};
  container.querySelectorAll("[data-permission]").forEach((input) => { result[input.dataset.permission] = input.checked; });
  return result;
}

export async function loadTeacherRequests() {
  els.teacherRequestList.innerHTML = "<div class='status'>교사 승인 요청을 불러오는 중입니다.</div>";
  try {
    const snap = await timeout(getDocs(query(collection(db, "teacherRequests"), where("status", "==", "pending"), limit(50))), 10000, "승인 요청 조회 시간이 초과되었습니다.");
    els.teacherRequestList.innerHTML = "";
    if (snap.empty) { els.teacherRequestList.innerHTML = "<div class='status success'>승인 대기 중인 교사 요청이 없습니다.</div>"; return; }
    snap.forEach((requestDoc) => {
      const data = requestDoc.data(), item = document.createElement("article"); item.className = "item";
      const title = document.createElement("h3"); title.textContent = data.name || "이름 정보 없음";
      const meta = document.createElement("div"); meta.className = "meta"; meta.textContent = `이메일: ${data.email ?? "없음"}\nUID: ${data.uid ?? requestDoc.id}`;
      const permissions = permissionFieldset(`pending-${requestDoc.id}`, { canAnswerQuestions: true });
      const actions = document.createElement("div"); actions.className = "actions";
      const approve = document.createElement("button"); approve.className = "approve"; approve.textContent = "선택 권한으로 승인";
      const reject = document.createElement("button"); reject.className = "reject"; reject.textContent = "요청 반려";
      approve.addEventListener("click", () => reviewTeacher(requestDoc.id, data, "approved", readPermissions(permissions), item, approve, reject));
      reject.addEventListener("click", () => reviewTeacher(requestDoc.id, data, "rejected", {}, item, approve, reject));
      actions.append(approve, reject); item.append(title, meta, permissions, actions); els.teacherRequestList.appendChild(item);
    });
  } catch (error) { els.teacherRequestList.innerHTML = `<div class="status error">교사 요청을 읽지 못했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}</div>`; }
}

async function reviewTeacher(uid, data, decision, permissions, item, approve, reject) {
  approve.disabled = true; reject.disabled = true;
  try {
    const batch = writeBatch(db);
    if (decision === "approved") {
      batch.set(doc(db, "users", uid), {
        role: "teacher", active: true, name: data.name ?? "", email: data.email ?? "", ...permissions,
        approvedAt: serverTimestamp(), approvedBy: state.currentUser.uid, updatedAt: serverTimestamp(), updatedBy: state.currentUser.uid
      }, { merge: true });
    }
    batch.update(doc(db, "teacherRequests", uid), { status: decision, reviewedAt: serverTimestamp(), reviewedBy: state.currentUser.uid, updatedAt: serverTimestamp(), permissions });
    await timeout(batch.commit(), 15000, "승인 저장 시간이 초과되었습니다.");
    item.remove(); showStatus(decision === "approved" ? "선택한 권한으로 교사 승인이 완료되었습니다." : "교사 요청을 반려했습니다.", decision === "approved" ? "success" : "warning");
    if (!els.teacherRequestList.children.length) els.teacherRequestList.innerHTML = "<div class='status success'>승인 대기 중인 교사 요청이 없습니다.</div>";
    if (decision === "approved") await loadApprovedTeachers();
  } catch (error) { showStatus(`교사 승인 처리에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error"); approve.disabled = false; reject.disabled = false; }
}

export async function loadApprovedTeachers() {
  els.approvedTeacherList.innerHTML = "<div class='status'>승인 교사를 불러오는 중입니다.</div>";
  try {
    const snap = await timeout(getDocs(query(collection(db, "users"), where("role", "==", "teacher"), where("active", "==", true), limit(100))), 10000, "교사 목록 조회 시간이 초과되었습니다.");
    els.approvedTeacherList.innerHTML = "";
    if (snap.empty) { els.approvedTeacherList.innerHTML = "<div class='status success'>승인된 교사가 없습니다.</div>"; return; }
    snap.docs.sort((a, b) => (a.data().name ?? "").localeCompare(b.data().name ?? "", "ko")).forEach((teacherDoc) => {
      const data = teacherDoc.data(), item = document.createElement("article"); item.className = "item teacher-rights-form";
      const title = document.createElement("h3"); title.textContent = data.name || "이름 정보 없음";
      const meta = document.createElement("div"); meta.className = "meta"; meta.textContent = `이메일: ${data.email ?? "없음"}\nUID: ${teacherDoc.id}`;
      const permissions = permissionFieldset(`teacher-${teacherDoc.id}`, data);
      const actions = document.createElement("div"); actions.className = "actions";
      const save = document.createElement("button"); save.className = "save-button"; save.textContent = "권한 변경 저장";
      const disable = document.createElement("button"); disable.className = "reject"; disable.textContent = "교사 이용 중지";
      save.addEventListener("click", () => saveTeacherPermissions(teacherDoc.id, readPermissions(permissions), save));
      disable.addEventListener("click", () => disableTeacher(teacherDoc.id, data.name || "교사", item, disable));
      actions.append(save, disable); item.append(title, meta, permissions, actions); els.approvedTeacherList.appendChild(item);
    });
  } catch (error) { els.approvedTeacherList.innerHTML = `<div class="status error">승인 교사 목록을 읽지 못했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}</div>`; }
}

async function saveTeacherPermissions(uid, permissions, button) {
  button.disabled = true;
  try { await timeout(updateDoc(doc(db, "users", uid), { ...permissions, updatedAt: serverTimestamp(), updatedBy: state.currentUser.uid }), 12000, "권한 저장 시간이 초과되었습니다."); showStatus("교사 권한 변경을 저장했습니다.", "success"); }
  catch (error) { showStatus(`교사 권한 저장에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error"); }
  finally { button.disabled = false; }
}

async function disableTeacher(uid, name, item, button) {
  if (!confirm(`${name} 교사의 이용을 중지하시겠습니까?`)) return;
  button.disabled = true;
  try { await timeout(updateDoc(doc(db, "users", uid), { active: false, updatedAt: serverTimestamp(), updatedBy: state.currentUser.uid }), 12000, "이용 중지 저장 시간이 초과되었습니다."); item.remove(); showStatus(`${name} 교사의 이용을 중지했습니다.`, "warning"); }
  catch (error) { showStatus(`교사 이용 중지에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error"); button.disabled = false; }
}

export async function requestTeacherRole() {
  els.requestButton.disabled = true;
  try {
    await setDoc(doc(db, "teacherRequests", state.currentUser.uid), { uid: state.currentUser.uid, name: state.currentUser.displayName ?? "", email: state.currentUser.email ?? "", status: "pending", requestedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    els.requestText.textContent = "교사 등록 요청이 접수되었습니다. 마스터 승인을 기다리고 있습니다."; els.requestButton.textContent = "승인 대기 중"; showStatus("교사 등록 요청이 완료되었습니다.", "success");
  } catch (error) { showStatus(`교사 등록 요청에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error"); els.requestButton.disabled = false; }
}
