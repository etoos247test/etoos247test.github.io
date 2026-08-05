import {
  collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where, writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { db, resetStudentPasswordCallable } from "./firebase-client.js";
import {
  SUBJECTS, CAMPUSES, campusLabel, els, state, showStatus, timeout, timestampValue,
  normalizedStatus, isAnswered, formatDate, allowedCampuses, canAnswerQuestions,
  canManageStudentInfo, canApproveStudents, canResetStudentPassword, studentDisplay,
  questionsForStudent, selectedStudent, isMaster
} from "./shared.js";

export function resetTeacherView() {
  state.selectedStudentUid = "all";
  state.selectedTeacherSubject = "all";
  state.selectedTeacherStatus = "waiting";
  els.studentDirectorySearch.value = "";
  document.querySelectorAll("[data-subject-filter]").forEach((b) => b.classList.toggle("active", b.dataset.subjectFilter === "all"));
  document.querySelectorAll("[data-status-filter]").forEach((b) => b.classList.toggle("active", b.dataset.statusFilter === "waiting"));
}

function renderPermissionBadges() {
  els.teacherPermissionBadges.innerHTML = "";
  const campuses = allowedCampuses().map(campusLabel).join(" · ") || "지점 없음";
  [
    [`관리 지점: ${campuses}`, true],
    ["질문 답변", canAnswerQuestions()],
    ["학생 승인", canApproveStudents()],
    ["학생정보", canManageStudentInfo()],
    ["비밀번호", canResetStudentPassword()]
  ].forEach(([label, enabled]) => {
    const badge = document.createElement("span");
    badge.className = `permission-badge ${enabled ? "on" : ""}`;
    badge.textContent = label;
    els.teacherPermissionBadges.appendChild(badge);
  });
}

export async function loadTeacherWorkspace() {
  renderPermissionBadges();
  const campuses = allowedCampuses();
  if (!campuses.length) {
    els.studentDirectorySummary.textContent = "관리 지점이 지정되지 않았습니다.";
    els.studentDirectoryList.innerHTML = "<div class='status warning'>마스터가 수성1관 또는 수성2관 접근권한을 부여해야 합니다.</div>";
    els.teacherQuestionList.innerHTML = "";
    return;
  }

  els.studentDirectoryList.innerHTML = "<div class='status'>관리 대상 학생을 불러오는 중입니다.</div>";
  els.teacherQuestionList.innerHTML = "<div class='status'>질문을 불러오는 중입니다.</div>";

  try {
    let studentQuery;
    let questionQuery = null;

    if (isMaster()) {
      studentQuery = query(collection(db, "users"), where("role", "==", "student"), limit(300));
      if (canAnswerQuestions()) questionQuery = query(collection(db, "questions"), limit(500));
    } else {
      const studentConstraints = [where("role", "==", "student"), where("campus", "in", campuses)];
      if (!canApproveStudents()) studentConstraints.push(where("active", "==", true));
      studentConstraints.push(limit(250));
      studentQuery = query(collection(db, "users"), ...studentConstraints);
      if (canAnswerQuestions()) questionQuery = query(collection(db, "questions"), where("campus", "in", campuses), limit(500));
    }

    const tasks = [getDocs(studentQuery)];
    if (questionQuery) tasks.push(getDocs(questionQuery));
    const [studentSnap, questionSnap] = await timeout(Promise.all(tasks), 15000, "학생·질문 현황 조회 시간이 초과되었습니다.");

    state.approvedStudents = studentSnap.docs.map((x) => ({ uid: x.id, ...x.data() })).sort((a, b) => {
      const campusCompare = (a.campus ?? "zzz").localeCompare(b.campus ?? "zzz");
      if (campusCompare) return campusCompare;
      const left = (a.studentId ?? "ZZZZ").toUpperCase();
      const right = (b.studentId ?? "ZZZZ").toUpperCase();
      return left.localeCompare(right, "ko") || (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });

    state.teacherQuestions = questionSnap
      ? questionSnap.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt))
      : [];

    renderStudentDirectory();
    renderTeacherQuestions();
  } catch (error) {
    console.error(error);
    els.studentDirectorySummary.textContent = "학생 현황을 불러오지 못했습니다.";
    els.studentDirectoryList.innerHTML = `<div class="status error">학생 목록을 읽지 못했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}</div>`;
    els.teacherQuestionList.innerHTML = "";
  }
}

export function renderStudentDirectory() {
  const keyword = els.studentDirectorySearch.value.trim().toLowerCase();
  const activeStudents = state.approvedStudents.filter((s) => s.active === true);
  const pendingStudents = state.approvedStudents.filter((s) => s.active !== true);
  const waitingTotal = state.teacherQuestions.filter((q) => normalizedStatus(q) === "waiting").length;
  const missingInfo = state.approvedStudents.filter((s) => !s.studentId || !s.name || !s.campus).length;

  els.studentDirectorySummary.textContent =
    `관리 학생 ${state.approvedStudents.length}명 · 승인 ${activeStudents.length}명` +
    (canApproveStudents() ? ` · 승인 대기/중지 ${pendingStudents.length}명` : "") +
    ` · 답변 대기 ${waitingTotal}건` +
    (missingInfo ? ` · 정보 보완 ${missingInfo}명` : "");

  els.studentDirectoryList.innerHTML = "";
  if (canAnswerQuestions()) {
    els.studentDirectoryList.appendChild(createStudentCard({
      uid: "all", studentId: "전체 학생", name: "허용 지점 전체", campus: "", active: true, isAll: true
    }));
  }

  const matched = state.approvedStudents.filter((student) => {
    const display = studentDisplay(student);
    return !keyword || `${campusLabel(display.campus)} ${display.studentId} ${display.name}`.toLowerCase().includes(keyword);
  });

  if (!matched.length) {
    const empty = document.createElement("div");
    empty.className = "status warning";
    empty.textContent = "검색 조건에 맞는 학생이 없습니다.";
    els.studentDirectoryList.appendChild(empty);
    return;
  }

  matched.forEach((student) => els.studentDirectoryList.appendChild(createStudentCard(studentDisplay(student))));
}

function createStudentCard(student) {
  const raw = state.approvedStudents.find((x) => x.uid === student.uid);
  const active = student.isAll ? true : raw?.active === true;
  const questions = questionsForStudent(student.uid);
  const waiting = questions.filter((q) => normalizedStatus(q) === "waiting");
  const answered = questions.filter((q) => normalizedStatus(q) === "answered");

  const card = document.createElement("article");
  card.className = `student-card ${state.selectedStudentUid === student.uid ? "active" : ""}`.trim();

  const select = document.createElement("button");
  select.type = "button";
  select.className = "student-select";

  const title = document.createElement("span");
  title.className = "student-card-title";
  title.textContent = student.isAll ? "전체 학생" : `${student.studentId} · ${student.name}`;

  const sub = document.createElement("span");
  sub.className = "student-card-sub";
  sub.textContent = student.isAll ? "허용 지점의 전체 질문" : `${campusLabel(student.campus)} · ${active ? "승인" : "승인 대기/중지"}`;

  const counts = document.createElement("span");
  counts.className = "student-card-counts";
  [[`대기 ${waiting.length}`, "mini-count"], [`전체 ${questions.length}`, "mini-count total"], [`완료 ${answered.length}`, "mini-count total"]]
    .forEach(([text, cls]) => {
      const value = document.createElement("span");
      value.className = cls;
      value.textContent = text;
      counts.appendChild(value);
    });

  const subjects = document.createElement("span");
  subjects.className = "subject-waits";
  const subjectCounts = SUBJECTS
    .map((subject) => ({ subject, count: waiting.filter((q) => q.subject === subject).length }))
    .filter((x) => x.count > 0);

  if (subjectCounts.length) {
    subjectCounts.forEach((x) => {
      const chip = document.createElement("span");
      chip.className = "subject-wait";
      chip.textContent = `${x.subject} ${x.count}`;
      subjects.appendChild(chip);
    });
  } else {
    const none = document.createElement("span");
    none.className = "subject-none";
    none.textContent = active ? "답변 대기 없음" : "학생 미승인";
    subjects.appendChild(none);
  }

  select.append(title, sub, counts, subjects);
  select.addEventListener("click", () => {
    state.selectedStudentUid = student.uid;
    state.selectedTeacherSubject = "all";
    state.selectedTeacherStatus = "waiting";
    document.querySelectorAll("[data-subject-filter]").forEach((b) => b.classList.toggle("active", b.dataset.subjectFilter === "all"));
    document.querySelectorAll("[data-status-filter]").forEach((b) => b.classList.toggle("active", b.dataset.statusFilter === "waiting"));
    renderStudentDirectory();
    renderTeacherQuestions();
  });
  card.appendChild(select);

  if (!student.isAll && (isMaster() || canApproveStudents() || canManageStudentInfo() || canResetStudentPassword())) {
    const actions = document.createElement("div");
    actions.className = "student-actions";

    if (isMaster()) {
      const campus = document.createElement("button");
      campus.type = "button";
      campus.className = "primary";
      campus.textContent = "소속관 지정";
      campus.addEventListener("click", () => changeStudentCampus(student.uid));
      actions.appendChild(campus);
    }

    if (canApproveStudents() && student.campus) {
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = active ? "reject" : "approve";
      approve.textContent = active ? "승인 중지" : "학생 승인";
      approve.addEventListener("click", () => setStudentActive(student.uid, !active));
      actions.appendChild(approve);
    }

    if (canManageStudentInfo() && student.campus) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary";
      edit.textContent = "번호·이름 수정";
      edit.addEventListener("click", () => editStudentInfo(student.uid));
      actions.appendChild(edit);
    }

    if (canResetStudentPassword() && active && student.campus) {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "password-button";
      reset.textContent = "임시 비밀번호";
      reset.addEventListener("click", () => resetStudentPassword(student.uid));
      actions.appendChild(reset);
    }

    card.appendChild(actions);
  }

  return card;
}

async function changeStudentCampus(uid) {
  const student = state.approvedStudents.find((x) => x.uid === uid);
  if (!student || !isMaster()) return;
  const current = student.campus === "suseong2" ? "2" : "1";
  const input = prompt("소속관을 입력하세요. 수성1관=1, 수성2관=2", current);
  if (input === null) return;
  const campus = input.trim() === "1" ? "suseong1" : input.trim() === "2" ? "suseong2" : "";
  if (!campus) {
    showStatus("소속관은 1 또는 2로 입력하세요.", "warning");
    return;
  }
  if (campus === student.campus) {
    showStatus("현재 소속관과 같습니다.", "warning");
    return;
  }

  try {
    await updateDoc(doc(db, "users", uid), {
      campus,
      updatedAt: serverTimestamp(),
      updatedBy: state.currentUser.uid
    });

    const questions = state.teacherQuestions.filter((q) => q.studentUid === uid);
    for (let start = 0; start < questions.length; start += 400) {
      const batch = writeBatch(db);
      questions.slice(start, start + 400).forEach((question) => {
        batch.update(doc(db, "questions", question.id), {
          campus,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    }

    student.campus = campus;
    questions.forEach((q) => { q.campus = campus; });
    showStatus(`${student.studentId || "학생"}의 소속을 ${campusLabel(campus)}으로 변경했습니다.`, "success");
    renderStudentDirectory();
    renderTeacherQuestions();
  } catch (error) {
    showStatus(`소속관 변경에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error");
  }
}

async function setStudentActive(uid, active) {
  const student = state.approvedStudents.find((x) => x.uid === uid);
  if (!student || !student.campus) return;
  const action = active ? "승인" : "승인 중지";
  if (!confirm(`${campusLabel(student.campus)} ${student.studentId || "학생"}을(를) ${action}하시겠습니까?`)) return;

  try {
    await timeout(updateDoc(doc(db, "users", uid), {
      active,
      approvedAt: active ? serverTimestamp() : null,
      approvedBy: state.currentUser.uid,
      updatedAt: serverTimestamp(),
      updatedBy: state.currentUser.uid
    }), 12000, "학생 승인 저장 시간이 초과되었습니다.");
    student.active = active;
    showStatus(`학생 ${action}이 완료되었습니다.`, active ? "success" : "warning");
    renderStudentDirectory();
  } catch (error) {
    showStatus(`학생 ${action}에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error");
  }
}

async function editStudentInfo(uid) {
  const student = state.approvedStudents.find((x) => x.uid === uid);
  if (!student) return;
  const studentId = prompt("학생번호를 입력하세요. (M001~M100)", (student.studentId || "").toUpperCase())?.trim().toUpperCase();
  if (studentId == null) return;
  if (!/^M(00[1-9]|0[1-9][0-9]|100)$/.test(studentId)) {
    showStatus("학생번호는 M001부터 M100까지 입력하세요.", "warning");
    return;
  }
  if (state.approvedStudents.some((x) => x.uid !== uid && (x.studentId || "").toUpperCase() === studentId)) {
    showStatus(`${studentId}는 현재 관리 범위에서 이미 사용 중입니다.`, "error");
    return;
  }
  const name = prompt("학생 이름을 입력하세요.", student.name || "")?.trim();
  if (!name) {
    showStatus("학생 이름을 입력하세요.", "warning");
    return;
  }

  try {
    await timeout(updateDoc(doc(db, "users", uid), {
      studentId,
      name,
      updatedAt: serverTimestamp(),
      updatedBy: state.currentUser.uid
    }), 12000, "학생정보 저장 시간이 초과되었습니다.");
    student.studentId = studentId;
    student.name = name;
    showStatus(`${campusLabel(student.campus)} ${studentId} · ${name} 정보를 저장했습니다.`, "success");
    renderStudentDirectory();
    renderTeacherQuestions();
  } catch (error) {
    showStatus(`학생정보 수정에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error");
  }
}

function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let value = "E247-";
  crypto.getRandomValues(new Uint32Array(8)).forEach((n) => { value += chars[n % chars.length]; });
  return value;
}

async function resetStudentPassword(uid) {
  const student = state.approvedStudents.find((x) => x.uid === uid);
  if (!student) return;
  const newPassword = prompt(`${campusLabel(student.campus)} ${student.studentId || "학생"}의 임시 비밀번호`, generateTemporaryPassword());
  if (newPassword === null) return;
  if (newPassword.length < 8 || newPassword.length > 64) {
    showStatus("임시 비밀번호는 8~64자로 입력하세요.", "warning");
    return;
  }

  try {
    showStatus("임시 비밀번호를 재발급하는 중입니다.");
    await timeout(resetStudentPasswordCallable({ uid, newPassword }), 20000, "비밀번호 재발급 시간이 초과되었습니다.");
    showStatus(`${campusLabel(student.campus)} ${student.studentId || "학생"} 임시 비밀번호 재발급 완료\n\n새 비밀번호: ${newPassword}\n\n지금 학생에게 전달하세요.`, "success");
  } catch (error) {
    showStatus(`비밀번호 재발급에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}\nCloud Functions 함수가 아직 배포되지 않았을 수 있습니다.`, "error");
  }
}

export function renderTeacherQuestions() {
  if (!canAnswerQuestions()) {
    els.teacherQuestionCount.textContent = "현재 계정에는 질문 열람·답변 권한이 없습니다.";
    els.teacherQuestionList.innerHTML = "<div class='status warning'>학생 관리 권한만 부여된 준마스터입니다. 마스터가 질문 답변 권한을 추가할 수 있습니다.</div>";
    return;
  }

  const selected = selectedStudent();
  const source = questionsForStudent(state.selectedStudentUid);
  const rows = source.filter((q) =>
    (state.selectedTeacherSubject === "all" || q.subject === state.selectedTeacherSubject)
    && normalizedStatus(q) === state.selectedTeacherStatus
  );

  if (selected) {
    els.selectedStudentTitle.textContent = `${campusLabel(selected.campus)} · ${selected.studentId} · ${selected.name}`;
    els.selectedStudentHelp.textContent = "이 학생의 질문만 표시합니다.";
  } else {
    els.selectedStudentTitle.textContent = "허용 지점 전체 학생 질문";
    els.selectedStudentHelp.textContent = "학생 카드를 누르면 해당 학생의 질문만 표시됩니다.";
  }

  const waitingCount = source.filter((q) => normalizedStatus(q) === "waiting").length;
  const answeredCount = source.filter((q) => normalizedStatus(q) === "answered").length;
  els.teacherQuestionCount.textContent = `현재 표시 ${rows.length}건 · 대기 ${waitingCount}건 · 완료 ${answeredCount}건`;
  els.teacherQuestionList.innerHTML = "";

  if (!rows.length) {
    els.teacherQuestionList.innerHTML = `<div class='status success'>현재 조건에 맞는 ${state.selectedTeacherStatus === "waiting" ? "답변 대기" : "답변 완료"} 질문이 없습니다.</div>`;
    return;
  }

  rows.forEach((data) => {
    const answered = isAnswered(data);
    const profile = state.approvedStudents.find((x) => x.uid === data.studentUid);
    const display = profile
      ? studentDisplay(profile)
      : { studentId: data.studentId || "미입력", name: data.studentName || "미입력", campus: data.campus || "" };

    const item = document.createElement("article");
    item.className = "item";
    const heading = document.createElement("h3");
    heading.textContent = `${data.subject ?? "과목 미지정"} · ${campusLabel(display.campus)} · ${display.studentId}`;
    const badge = document.createElement("span");
    badge.className = `badge ${answered ? "answered" : ""}`;
    badge.textContent = answered ? "답변 완료" : "답변 대기";
    heading.appendChild(badge);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `학생번호: ${display.studentId}\n학생 이름: ${display.name}\n등록: ${formatDate(data.createdAt)}`;
    const question = document.createElement("div");
    question.className = "question-text";
    question.textContent = data.questionText ?? "";
    const answer = document.createElement("textarea");
    answer.value = data.answer ?? "";
    answer.placeholder = "학생에게 전달할 답변을 입력하세요.";
    const action = document.createElement("div");
    action.className = "actions";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.textContent = answered ? "답변 수정 저장" : "답변 저장";
    button.addEventListener("click", () => saveAnswer(data.id, answer, button));
    action.appendChild(button);
    item.append(heading, meta, question, answer, action);
    els.teacherQuestionList.appendChild(item);
  });
}

async function saveAnswer(questionId, textarea, button) {
  const answer = textarea.value.trim();
  if (answer.length < 2) {
    showStatus("답변 내용을 입력하세요.", "warning");
    return;
  }
  button.disabled = true;
  button.textContent = "저장 중…";

  try {
    await timeout(updateDoc(doc(db, "questions", questionId), {
      answer,
      status: "answered",
      answeredAt: serverTimestamp(),
      answeredBy: state.currentUser.uid,
      updatedAt: serverTimestamp()
    }), 12000, "답변 저장 시간이 초과되었습니다.");
    const target = state.teacherQuestions.find((q) => q.id === questionId);
    if (target) {
      target.answer = answer;
      target.status = "answered";
    }
    showStatus("답변이 저장되었습니다.", "success");
    renderStudentDirectory();
    renderTeacherQuestions();
  } catch (error) {
    showStatus(`답변 저장에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error");
    button.disabled = false;
    button.textContent = "답변 저장";
  }
}

export function bindTeacherFilters() {
  document.querySelectorAll("[data-subject-filter]").forEach((button) => button.addEventListener("click", () => {
    state.selectedTeacherSubject = button.dataset.subjectFilter;
    document.querySelectorAll("[data-subject-filter]").forEach((x) => x.classList.toggle("active", x === button));
    renderTeacherQuestions();
  }));

  document.querySelectorAll("[data-status-filter]").forEach((button) => button.addEventListener("click", () => {
    state.selectedTeacherStatus = button.dataset.statusFilter;
    document.querySelectorAll("[data-status-filter]").forEach((x) => x.classList.toggle("active", x === button));
    renderTeacherQuestions();
  }));

  els.studentDirectorySearch.addEventListener("input", renderStudentDirectory);
}
