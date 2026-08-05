import {
  collection, doc, getDocs, limit, query, runTransaction, serverTimestamp, updateDoc, where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { db } from "./firebase-client.js";
import {
  STUDENT_CODE_PATTERN, allowedCampuses, campusFromStudentId, campusLabel,
  canApproveStudents, els, formatDate, isMaster, showStatus, state, studentCodeRange, timeout
} from "./shared.js";
import { loadTeacherWorkspace } from "./teacher.js";

export function configureStudentApprovalPanel() {
  const enabled = canApproveStudents() && allowedCampuses().length > 0;
  els.studentApprovalPanel.classList.toggle("hidden", !enabled);
  if (!enabled) els.studentApplicationList.innerHTML = "";
  return enabled;
}

async function fetchPendingApplications() {
  if (isMaster()) {
    const snap = await getDocs(query(
      collection(db, "studentApplications"),
      where("status", "==", "pending"),
      limit(100)
    ));
    return snap.docs.map((x) => ({ id: x.id, ...x.data() }));
  }

  const campuses = allowedCampuses();
  const snapshots = await Promise.all(campuses.map((campus) => getDocs(query(
    collection(db, "studentApplications"),
    where("status", "==", "pending"),
    where("campus", "==", campus),
    limit(100)
  ))));

  return snapshots.flatMap((snap) => snap.docs.map((x) => ({ id: x.id, ...x.data() })));
}

export async function loadStudentApplications() {
  if (!configureStudentApprovalPanel()) return;

  els.studentApplicationList.innerHTML = "<div class='status'>학생 가입 요청을 불러오는 중입니다.</div>";
  try {
    const rows = await timeout(fetchPendingApplications(), 15000, "학생 가입 요청 조회 시간이 초과되었습니다.");
    rows.sort((a, b) => (a.requestedAt?.toMillis?.() ?? 0) - (b.requestedAt?.toMillis?.() ?? 0));
    renderStudentApplications(rows);
  } catch (error) {
    els.studentApplicationList.innerHTML =
      `<div class="status error">학생 가입 요청을 읽지 못했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}</div>`;
  }
}

function renderStudentApplications(rows) {
  els.studentApplicationList.innerHTML = "";
  if (!rows.length) {
    els.studentApplicationList.innerHTML = "<div class='status success'>승인 대기 중인 학생 가입 요청이 없습니다.</div>";
    return;
  }

  rows.forEach((application) => {
    const item = document.createElement("article");
    item.className = "item student-application-item";

    const title = document.createElement("h3");
    title.textContent = `${campusLabel(application.campus)} · ${application.name}`;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent =
      `Google 계정: ${application.email ?? "없음"}\n` +
      `연락처 뒤 4자리: ${application.contactLast4 ?? "없음"}\n` +
      `접수: ${formatDate(application.requestedAt)}`;

    const form = document.createElement("div");
    form.className = "student-approval-form";

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "학생 이름";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = 40;
    nameInput.value = application.name ?? "";
    nameLabel.appendChild(nameInput);

    const codeLabel = document.createElement("label");
    codeLabel.textContent = "부여할 내부 학생번호";
    const codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.maxLength = 4;
    codeInput.placeholder = application.campus === "suseong1" ? "M001" : "S001";
    codeInput.addEventListener("input", () => {
      codeInput.value = codeInput.value.trim().toUpperCase();
    });
    codeLabel.appendChild(codeInput);

    form.append(nameLabel, codeLabel);

    const actions = document.createElement("div");
    actions.className = "actions";
    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "approve";
    approve.textContent = "학생번호 부여 후 승인";
    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "reject";
    reject.textContent = "신청 반려";

    approve.addEventListener("click", async () => {
      const studentId = codeInput.value.trim().toUpperCase();
      const name = nameInput.value.trim();

      if (!STUDENT_CODE_PATTERN.test(studentId)) {
        showStatus(`학생번호는 ${studentCodeRange(application.campus)} 범위에서 입력하세요.`, "warning");
        return;
      }
      if (campusFromStudentId(studentId) !== application.campus) {
        showStatus(`${campusLabel(application.campus)} 학생번호는 ${studentCodeRange(application.campus)}입니다.`, "warning");
        return;
      }
      if (name.length < 2 || name.length > 40) {
        showStatus("학생 이름을 2~40자로 입력하세요.", "warning");
        return;
      }

      approve.disabled = true;
      reject.disabled = true;
      approve.textContent = "승인 저장 중…";

      try {
        await timeout(runTransaction(db, async (transaction) => {
          const applicationRef = doc(db, "studentApplications", application.id);
          const studentRef = doc(db, "users", application.id);
          const codeRef = doc(db, "studentCodes", studentId);

          const applicationSnap = await transaction.get(applicationRef);
          const codeSnap = await transaction.get(codeRef);

          if (!applicationSnap.exists() || applicationSnap.data().status !== "pending") {
            throw new Error("이미 처리되었거나 존재하지 않는 가입 요청입니다.");
          }
          if (codeSnap.exists() && codeSnap.data().uid !== application.id) {
            throw new Error(`${studentId}는 이미 다른 학생에게 부여된 번호입니다.`);
          }

          transaction.set(studentRef, {
            role: "student",
            active: true,
            campus: application.campus,
            studentId,
            name,
            email: application.email ?? "",
            authProvider: "google.com",
            approvedAt: serverTimestamp(),
            approvedBy: state.currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            updatedBy: state.currentUser.uid
          });

          transaction.set(codeRef, {
            uid: application.id,
            campus: application.campus,
            studentId,
            name,
            updatedAt: serverTimestamp(),
            updatedBy: state.currentUser.uid
          });

          transaction.update(applicationRef, {
            status: "approved",
            assignedStudentId: studentId,
            approvedName: name,
            reviewedAt: serverTimestamp(),
            reviewedBy: state.currentUser.uid,
            updatedAt: serverTimestamp()
          });
        }), 20000, "학생 승인 저장 시간이 초과되었습니다.");

        item.remove();
        showStatus(`${campusLabel(application.campus)} ${studentId} · ${name} 승인이 완료되었습니다. 학생은 같은 Google 계정으로 로그인하면 됩니다.`, "success");
        if (!els.studentApplicationList.children.length) {
          els.studentApplicationList.innerHTML = "<div class='status success'>승인 대기 중인 학생 가입 요청이 없습니다.</div>";
        }
        await loadTeacherWorkspace();
      } catch (error) {
        showStatus(`학생 승인에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error");
        approve.disabled = false;
        reject.disabled = false;
        approve.textContent = "학생번호 부여 후 승인";
      }
    });

    reject.addEventListener("click", async () => {
      if (!confirm(`${application.name} 학생 가입 요청을 반려하시겠습니까?`)) return;
      approve.disabled = true;
      reject.disabled = true;

      try {
        await timeout(updateDoc(doc(db, "studentApplications", application.id), {
          status: "rejected",
          reviewedAt: serverTimestamp(),
          reviewedBy: state.currentUser.uid,
          updatedAt: serverTimestamp()
        }), 12000, "학생 가입 요청 반려 시간이 초과되었습니다.");

        item.remove();
        showStatus("학생 가입 요청을 반려했습니다.", "warning");
        if (!els.studentApplicationList.children.length) {
          els.studentApplicationList.innerHTML = "<div class='status success'>승인 대기 중인 학생 가입 요청이 없습니다.</div>";
        }
      } catch (error) {
        showStatus(`학생 가입 요청 반려에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error");
        approve.disabled = false;
        reject.disabled = false;
      }
    });

    actions.append(approve, reject);
    item.append(title, meta, form, actions);
    els.studentApplicationList.appendChild(item);
  });
}
