const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

const db = getFirestore();
const auth = getAuth();
const VALID_CAMPUSES = new Set(["suseong1", "suseong2"]);

async function getProfile(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "사용자 권한 문서가 없습니다.");
  return { uid, ...snap.data() };
}

function hasCampusAccess(profile, campus) {
  if (profile.role === "master" && profile.active === true) return true;
  return profile.role === "teacher"
    && profile.active === true
    && Array.isArray(profile.allowedCampuses)
    && profile.allowedCampuses.includes(campus);
}

exports.resetStudentPassword = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const uid = typeof request.data?.uid === "string" ? request.data.uid.trim() : "";
  const newPassword = typeof request.data?.newPassword === "string" ? request.data.newPassword : "";
  if (!uid) throw new HttpsError("invalid-argument", "학생 UID가 필요합니다.");
  if (newPassword.length < 8 || newPassword.length > 64) {
    throw new HttpsError("invalid-argument", "임시 비밀번호는 8~64자여야 합니다.");
  }

  const [caller, targetSnap] = await Promise.all([
    getProfile(request.auth.uid),
    db.doc(`users/${uid}`).get()
  ]);

  if (!targetSnap.exists) throw new HttpsError("not-found", "학생 문서를 찾을 수 없습니다.");
  const target = { uid, ...targetSnap.data() };
  if (target.role !== "student") throw new HttpsError("failed-precondition", "학생 계정이 아닙니다.");
  if (!VALID_CAMPUSES.has(target.campus)) throw new HttpsError("failed-precondition", "학생 소속관이 올바르지 않습니다.");

  const allowed = caller.role === "master"
    || (
      caller.role === "teacher"
      && caller.active === true
      && caller.canResetStudentPassword === true
      && hasCampusAccess(caller, target.campus)
    );
  if (!allowed) throw new HttpsError("permission-denied", "이 학생의 비밀번호를 재발급할 권한이 없습니다.");

  await auth.updateUser(uid, { password: newPassword });

  const batch = db.batch();
  batch.set(db.doc(`users/${uid}`), {
    mustChangePassword: true,
    passwordResetAt: FieldValue.serverTimestamp(),
    passwordResetBy: request.auth.uid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid
  }, { merge: true });
  batch.set(db.collection("auditLogs").doc(), {
    action: "student_password_reset",
    targetUid: uid,
    targetStudentId: target.studentId || "",
    campus: target.campus,
    actorUid: request.auth.uid,
    actorRole: caller.role,
    createdAt: FieldValue.serverTimestamp()
  });
  await batch.commit();

  return { ok: true, uid, campus: target.campus };
});
