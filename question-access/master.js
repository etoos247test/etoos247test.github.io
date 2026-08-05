import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { db } from "./firebase-client.js";
import { CAMPUSES, campusLabel, els, state, showStatus, timeout } from "./shared.js";

function permissionFieldset(prefix, values = {}) {
  const box = document.createElement("fieldset");
  box.className = "permission-box";

  const campusLegend = document.createElement("legend");
  campusLegend.textContent = "관리 지점과 권한";
  box.appendChild(campusLegend);

  CAMPUSES.forEach((campus) => {
    const row = document.createElement("label"); row.className = "permission-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `${prefix}-campus-${campus.id}`;
    input.dataset.campus = campus.id;
    input.checked = Array.isArray(values.allowedCampuses) ? values.allowedCampuses.includes(campus.id) : false;
    const text = document.createElement("span");
    text.innerHTML = `${campus.label} 학생 접근<span class="permission-help">이 관의 학생과 질문만 노출됩니다.</span>`;
    row.append(input, text); box.appendChild(row);
  });

  [
    ["canAnswerQuestions", "질문 열람·답변", "허용된 관 학생의 질문을 읽고 답변합니다.", values.canAnswerQuestions !== false],
    ["canApproveStudents", "학생 승인·이용중지", "허용된 관에서 학생 승인 상태를 변경하는 준마스터 권한입니다.", values.canApproveStudents === true],
    ["canManageStudentInfo", "학생번호·이름 수정", "허용된 관 학생의 번호와 이름만 수정합니다.", values.canManageStudentInfo === true],
    ["canResetStudentPassword", "임시 비밀번호 재발급", "허용된 관 학생의 비밀번호를 보안 서버 함수로 재발급합니다.", values.canResetStudentPassword === true]
  ].forEach(([key, label, help, checked]) => {
    const row = document.createElement("label"); row.className = "permission-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `${prefix}-${key}`;
    input.dataset.permission = key;
    input.checked = checked;
    const text = document.createElement("span");
    text.innerHTML = `${label}<span class="permission-help">${help}</span>`;
    row.append(input, text); box.appendChild(row);
  });

  return box;
}

function readAccess(container) {
  const allowedCampuses = [...container.querySelectorAll("[data-campus]:checked")].map((input) => input.dataset.campus);
  const permissions = {};
  container.querySelectorAll("[data-permission]").forEach((input) => { permissions[input.dataset.permission] = input.checked; });
  return { allowedCampuses, ...permissions };
}

function validateAccess(access) {
  if (!access.allowedCampuses.length) {
    showStatus("교사에게 수성1관 또는 수성2관을 최소 한 곳 이상 부여하세요.", "warning");
    return false;
  }
  return true;
}

export async function loadTeacherRequests() {
  els.teacherRequestList.innerHTML = "<div class='status'>교사 승인 요청을 불러오는 중입니다.</div>";
  try {
    const snap = await timeout(
      getDocs(query(collection(db, "teacherRequests"), where("status", "==", "pending"), limit(50))),
      10000,
      "승인 요청 조회 시간이 초과되었습니다."
    );
    els.teacherRequestList.innerHTML = "";
    if (snap.empty) {
      els.teacherRequestList.innerHTML = "<div class='status success'>승인 대기 중인 교사 요청이 없습니다.</div>";
      return;
    }

    snap.forEach((requestDoc) => {
      const data = requestDoc.data();
      const item = document.createElement("article"); item.className = "item";
      const title = document.createElement("h3"); title.textContent = data.name || "이름 정보 없음";
      const meta = document.createElement("div"); meta.className = "meta";
      meta.textContent = `이메일: ${data.email ?? "없음"}\nUID: ${data.uid ?? requestDoc.id}`;
      const access = permissionFieldset(`pending-${requestDoc.id}`, { canAnswerQuestions: true, allowedCampuses: [] });
      const actions = document.createElement("div"); actions.className = "actions";
      const approve = document.createElement("button"); approve.className = "approve"; approve.textContent = "선택 지점·권한으로 승인";
      const reject = document.createElement("button"); reject.className = "reject"; reject.textContent = "요청 반려";
      approve.addEventListener("click", () => {
        const selected = readAccess(access);
        if (!validateAccess(selected)) return;
        reviewTeacher(requestDoc.id, data, "approved", selected, item, approve, reject);
      });
      reject.addEventListener("click", () => reviewTeacher(requestDoc.id, data, "rejected", {}, item, approve, reject));
      actions.append(approve, reject); item.append(title, meta, access, actions); els.teacherRequestList.appendChild(item);
    });
  } catch (error) {
    els.teacherRequestList.innerHTML = `<div class="status error">교사 요청을 읽지 못했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}</div>`;
  }
}

async function reviewTeacher(uid, data, decision, access, item, approve, reject) {
  approve.disabled = true; reject.disabled = true;
  try {
    const batch = writeBatch(db);
    if (decision === "approved") {
      batch.set(doc(db, "users", uid), {
        role: "teacher",
        active: true,
        name: data.name ?? "",
        email: data.email ?? "",
        ...access,
        approvedAt: serverTimestamp(),
        approvedBy: state.currentUser.uid,
        updatedAt: serverTimestamp(),
        updatedBy: state.currentUser.uid
      }, { merge: true });
    }
    batch.update(doc(db, "teacherRequests", uid), {
      status: decision,
      reviewedAt: serverTimestamp(),
      reviewedBy: state.currentUser.uid,
      updatedAt: serverTimestamp(),
      access
    });
    await timeout(batch.commit(), 15000, "승인 저장 시간이 초과되었습니다.");
    item.remove();
    showStatus(decision === "approved" ? "선택한 지점과 권한으로 교사 승인이 완료되었습니다." : "교사 요청을 반려했습니다.", decision === "approved" ? "success" : "warning");
    if (!els.teacherRequestList.children.length) els.teacherRequestList.innerHTML = "<div class='status success'>승인 대기 중인 교사 요청이 없습니다.</div>";
    if (decision === "approved") await loadApprovedTeachers();
  } catch (error) {
    showStatus(`교사 승인 처리에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error");
    approve.disabled = false; reject.disabled = false;
  }
}

export async function loadApprovedTeachers() {
  els.approvedTeacherList.innerHTML = "<div class='status'>승인 교사를 불러오는 중입니다.</div>";
  try {
    const snap = await timeout(
      getDocs(query(collection(db, "users"), where("role", "==", "teacher"), limit(100))),
      10000,
      "교사 목록 조회 시간이 초과되었습니다."
    );
    els.approvedTeacherList.innerHTML = "";
    if (snap.empty) {
      els.approvedTeacherList.innerHTML = "<div class='status success'>등록된 교사가 없습니다.</div>";
      return;
    }

    snap.docs.sort((a, b) => (a.data().name ?? "").localeCompare(b.data().name ?? "", "ko")).forEach((teacherDoc) => {
      const data = teacherDoc.data();
      const item = document.createElement("article"); item.className = "item teacher-rights-form";
      const title = document.createElement("h3"); title.textContent = data.name || "이름 정보 없음";
      const campusText = Array.isArray(data.allowedCampuses) && data.allowedCampuses.length
        ? data.allowedCampuses.map(campusLabel).join(" · ")
        : "관리 지점 미지정";
      const meta = document.createElement("div"); meta.className = "meta";
      meta.textContent = `이메일: ${data.email ?? "없음"}\nUID: ${teacherDoc.id}\n현재 상태: ${data.active === true ? "사용 중" : "이용 중지"}\n관리 지점: ${campusText}`;
      const access = permissionFieldset(`teacher-${teacherDoc.id}`, data);
      const actions = document.createElement("div"); actions.className = "actions";
      const save = document.createElement("button"); save.className = "save-button"; save.textContent = "지점·권한 변경 저장";
      const toggle = document.createElement("button"); toggle.className = data.active === true ? "reject" : "approve"; toggle.textContent = data.active === true ? "교사 이용 중지" : "교사 이용 재개";
      save.addEventListener("click", () => {
        const selected = readAccess(access);
        if (!validateAccess(selected)) return;
        saveTeacherAccess(teacherDoc.id, selected, save);
      });
      toggle.addEventListener("click", () => toggleTeacher(teacherDoc.id, data.name || "교사", data.active !== true, item, toggle));
      actions.append(save, toggle); item.append(title, meta, access, actions); els.approvedTeacherList.appendChild(item);
    });
  } catch (error) {
    els.approvedTeacherList.innerHTML = `<div class="status error">승인 교사 목록을 읽지 못했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}</div>`;
  }
}

async function saveTeacherAccess(uid, access, button) {
  button.disabled = true;
  try {
    await timeout(updateDoc(doc(db, "users", uid), {
      ...access,
      updatedAt: serverTimestamp(),
      updatedBy: state.currentUser.uid
    }), 12000, "권한 저장 시간이 초과되었습니다.");
    showStatus("교사의 관리 지점과 세부 권한을 저장했습니다.", "success");
  } catch (error) {
    showStatus(`교사 권한 저장에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error");
  } finally { button.disabled = false; }
}

async function toggleTeacher(uid, name, active, item, button) {
  const action = active ? "이용 재개" : "이용 중지";
  if (!confirm(`${name} 교사의 ${action}를 진행하시겠습니까?`)) return;
  button.disabled = true;
  try {
    await timeout(updateDoc(doc(db, "users", uid), {
      active,
      updatedAt: serverTimestamp(),
      updatedBy: state.currentUser.uid
    }), 12000, `${action} 저장 시간이 초과되었습니다.`);
    showStatus(`${name} 교사의 ${action}를 완료했습니다.`, active ? "success" : "warning");
    await loadApprovedTeachers();
  } catch (error) {
    showStatus(`교사 ${action}에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error");
    button.disabled = false;
  }
}

export async function requestTeacherRole() {
  els.requestButton.disabled = true;
  try {
    await setDoc(doc(db, "teacherRequests", state.currentUser.uid), {
      uid: state.currentUser.uid,
      name: state.currentUser.displayName ?? "",
      email: state.currentUser.email ?? "",
      status: "pending",
      requestedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    els.requestText.textContent = "교사 등록 요청이 접수되었습니다. 마스터 승인을 기다리고 있습니다.";
    els.requestButton.textContent = "승인 대기 중";
    showStatus("교사 등록 요청이 완료되었습니다.", "success");
  } catch (error) {
    showStatus(`교사 등록 요청에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error");
    els.requestButton.disabled = false;
  }
}
