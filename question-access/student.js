import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "./firebase-client.js";
import { $, els, state, showStatus, timeout, timestampValue, formatDate, isAnswered, campusLabel } from "./shared.js";

const CAMPUS_EMAIL_PREFIX = {
  suseong1: "s1",
  suseong2: "s2"
};

export function studentEmail(campus, studentId) {
  const prefix = CAMPUS_EMAIL_PREFIX[campus];
  const id = studentId.trim().toUpperCase();
  if (!prefix) throw new Error("소속관을 선택하세요.");
  if (!/^M(00[1-9]|0[1-9][0-9]|100)$/.test(id)) throw new Error("학생번호는 M001부터 M100까지 입력할 수 있습니다.");
  return `${prefix}-${id.toLowerCase()}@etoos247test.local`;
}

export async function studentLogin(event) {
  event.preventDefault();
  const submit = els.studentLoginForm.querySelector("button");
  submit.disabled = true;
  try {
    const campus = $("studentCampus").value;
    const email = studentEmail(campus, $("studentId").value);
    sessionStorage.setItem("etoos247StudentCampus", campus);
    await signInWithEmailAndPassword(auth, email, $("studentPassword").value);
  } catch (error) {
    sessionStorage.removeItem("etoos247StudentCampus");
    const message = error.code === "auth/operation-not-allowed"
      ? "Firebase에서 이메일/비밀번호 로그인 기능이 아직 켜지지 않았습니다."
      : error.code === "auth/invalid-credential"
        ? "소속관, 학생번호 또는 비밀번호가 맞지 않습니다."
        : error.message ?? String(error);
    showStatus(`학생 로그인에 실패했습니다.\n오류 코드: ${error.code ?? "확인 불가"}\n${message}`, "error");
  } finally {
    submit.disabled = false;
  }
}

export async function loadStudentQuestions() {
  els.studentQuestionList.innerHTML = "<div class='status'>내 질문을 불러오는 중입니다.</div>";
  try {
    const snap = await timeout(getDocs(query(collection(db, "questions"), where("studentUid", "==", state.currentUser.uid))), 10000, "질문 조회 시간이 초과되었습니다.");
    const rows = snap.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
    els.studentQuestionList.innerHTML = "";
    if (!rows.length) {
      els.studentQuestionList.innerHTML = "<div class='status success'>등록한 질문이 없습니다.</div>";
      return;
    }
    rows.forEach((data) => {
      const answered = isAnswered(data);
      const item = document.createElement("article");
      item.className = "item";
      const heading = document.createElement("h3");
      heading.textContent = `${data.subject ?? "과목 미지정"} · ${campusLabel(data.campus ?? state.currentProfile?.campus)}`;
      const badge = document.createElement("span");
      badge.className = `badge ${answered ? "answered" : ""}`;
      badge.textContent = answered ? "답변 완료" : "답변 대기";
      heading.appendChild(badge);
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `등록: ${formatDate(data.createdAt)}`;
      const question = document.createElement("div");
      question.className = "question-text";
      question.textContent = data.questionText ?? "";
      const answer = document.createElement("div");
      answer.className = `answer-text ${answered ? "" : "answer-empty"}`;
      answer.textContent = answered ? data.answer : "아직 답변이 등록되지 않았습니다.";
      item.append(heading, meta, question, answer);
      els.studentQuestionList.appendChild(item);
    });
  } catch (error) {
    els.studentQuestionList.innerHTML = `<div class="status error">내 질문을 읽지 못했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}</div>`;
  }
}

export async function submitQuestion(event) {
  event.preventDefault();
  const subject = $("subject").value;
  const questionText = $("questionText").value.trim();
  const button = $("questionSubmitButton");
  const campus = state.currentProfile?.campus;
  if (!campus) {
    showStatus("학생 소속관이 지정되지 않았습니다. 관리자에게 문의하세요.", "error");
    return;
  }
  if (!subject || questionText.length < 2) {
    showStatus("과목과 질문 내용을 확인하세요.", "warning");
    return;
  }
  button.disabled = true;
  showStatus("질문을 등록하는 중입니다.");
  try {
    await timeout(addDoc(collection(db, "questions"), {
      studentUid: state.currentUser.uid,
      studentId: state.currentProfile.studentId ?? "",
      studentName: state.currentProfile.name ?? "",
      campus,
      subject,
      questionText,
      status: "waiting",
      answer: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }), 12000, "질문 등록 시간이 초과되었습니다.");
    els.questionForm.reset();
    showStatus("질문이 등록되었습니다.", "success");
    await loadStudentQuestions();
  } catch (error) {
    showStatus(`질문 등록에 실패했습니다.\n${error.code ?? ""} ${error.message ?? String(error)}`, "error");
  } finally {
    button.disabled = false;
  }
}
