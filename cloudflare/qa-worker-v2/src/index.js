import { verifyFirebaseIdToken } from './firebase-auth.js';
import { buildAttachmentKey } from './storage-path.js';

const CAMPUSES = new Set(['suseong1', 'suseong2']);
const SUBJECTS = new Set(['국어', '수학', '영어', '사탐', '과탐', '입시']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function nowIso() {
  return new Date().toISOString();
}

function fail(status, message, detail) {
  const error = new Error(message);
  error.status = status;
  error.detail = detail;
  throw error;
}

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get('origin');
  const allowedOrigin = env.ALLOWED_ORIGIN;
  const origin = requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function toFlag(value) {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

function uniqueCampuses(value) {
  const rows = Array.isArray(value) ? value : [];
  return [...new Set(rows.map((item) => cleanText(item, 20)).filter((item) => CAMPUSES.has(item)))];
}

function validateStudentId(campus, studentId) {
  const normalized = cleanText(studentId, 10).toUpperCase();
  const match = /^([MS])(\d{3})$/.exec(normalized);
  if (!match) fail(400, '학생번호는 M001 또는 S001 형식이어야 합니다.');
  const expectedPrefix = campus === 'suseong1' ? 'M' : 'S';
  const number = Number(match[2]);
  if (match[1] !== expectedPrefix || number < 1 || number > 199) {
    fail(400, campus === 'suseong1'
      ? '수성1관 학생번호는 M001~M199 범위여야 합니다.'
      : '수성2관 학생번호는 S001~S199 범위여야 합니다.');
  }
  return normalized;
}

async function getProfile(env, uid) {
  return env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first();
}

async function getTeacherCampuses(env, uid) {
  const result = await env.DB.prepare(
    'SELECT campus FROM teacher_campuses WHERE teacher_uid = ? ORDER BY campus'
  ).bind(uid).all();
  return result.results.map((row) => row.campus);
}

async function authContext(request, env) {
  const identity = await verifyFirebaseIdToken(request, env);
  const profile = await getProfile(env, identity.uid);
  return { identity, profile };
}

function requireActiveProfile(context) {
  if (!context.profile || context.profile.active !== 1) {
    fail(403, '승인된 활성 사용자만 이용할 수 있습니다.');
  }
  return context.profile;
}

function requireMaster(context) {
  const profile = requireActiveProfile(context);
  if (profile.role !== 'master') fail(403, '마스터 권한이 필요합니다.');
  return profile;
}

async function allowedCampusesForApprover(env, profile) {
  if (profile.role === 'master') return ['suseong1', 'suseong2'];
  if (profile.role !== 'teacher' || profile.can_approve_students !== 1) {
    fail(403, '학생 승인 권한이 필요합니다.');
  }
  return getTeacherCampuses(env, profile.uid);
}

async function allowedCampusesForStudentManager(env, profile) {
  if (profile.role === 'master') return ['suseong1', 'suseong2'];
  if (profile.role !== 'teacher' || profile.can_manage_student_info !== 1) {
    fail(403, '학생정보 관리 권한이 필요합니다.');
  }
  return getTeacherCampuses(env, profile.uid);
}

async function audit(env, actorUid, action, targetType, targetId, campus = null, detail = null) {
  await env.DB.prepare(`
    INSERT INTO audit_logs (id,actor_uid,action,target_type,target_id,campus,detail_json,created_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(
    crypto.randomUUID(),
    actorUid,
    action,
    targetType,
    targetId,
    campus,
    detail ? JSON.stringify(detail) : null,
    nowIso()
  ).run();
}

async function getQuestion(env, questionId) {
  return env.DB.prepare('SELECT * FROM questions WHERE id = ?').bind(questionId).first();
}

async function canReadQuestion(env, profile, question) {
  if (!profile || !question || profile.active !== 1) return false;
  if (profile.role === 'master') return true;
  if (profile.role === 'student') return question.student_uid === profile.uid;
  if (profile.role !== 'teacher' || profile.can_answer_questions !== 1) return false;
  const campus = await env.DB.prepare(
    'SELECT 1 AS allowed FROM teacher_campuses WHERE teacher_uid = ? AND campus = ?'
  ).bind(profile.uid, question.campus).first();
  return Boolean(campus?.allowed);
}

async function requireQuestionAccess(env, profile, questionId) {
  const question = await getQuestion(env, questionId);
  if (!question) fail(404, '질문을 찾을 수 없습니다.');
  if (!(await canReadQuestion(env, profile, question))) {
    fail(403, '이 질문에 접근할 권한이 없습니다.');
  }
  return question;
}

function filesFromForm(form) {
  return form.getAll('images').filter(
    (value) => value && typeof value === 'object' && 'arrayBuffer' in value
  );
}

async function validateAndUploadFiles({ env, files, campus, questionId, messageId, uploader, createdAt }) {
  const maxBytes = Number(env.MAX_IMAGE_BYTES || 1048576);
  const maxImages = Number(env.MAX_IMAGES_PER_MESSAGE || 3);
  if (files.length > maxImages) {
    fail(400, `사진은 한 메시지당 최대 ${maxImages}장까지 첨부할 수 있습니다.`);
  }

  const rows = [];
  for (const file of files) {
    if (!IMAGE_TYPES.has(file.type)) fail(400, 'JPG·PNG·WebP 사진만 첨부할 수 있습니다.');
    if (!file.size || file.size > maxBytes) {
      fail(400, '사진 한 장은 압축 후 1MB 이하여야 합니다.');
    }

    const attachmentId = crypto.randomUUID();
    const objectKey = buildAttachmentKey({
      campus,
      createdAt,
      questionId,
      messageId,
      attachmentId,
      contentType: file.type
    });
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');

    await env.ATTACHMENTS.put(objectKey, bytes, {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        attachmentId,
        questionId,
        messageId,
        uploaderUid: uploader.uid
      }
    });

    rows.push({
      id: attachmentId,
      objectKey,
      originalName: cleanText(file.name || 'image', 160),
      contentType: file.type,
      sizeBytes: file.size,
      sha256
    });
  }
  return rows;
}

async function deleteUploaded(env, rows) {
  await Promise.allSettled(rows.map((row) => env.ATTACHMENTS.delete(row.objectKey)));
}

async function getMePayload(env, context) {
  const campuses = context.profile?.role === 'teacher'
    ? await getTeacherCampuses(env, context.identity.uid)
    : context.profile?.role === 'master'
      ? ['suseong1', 'suseong2']
      : [];
  const [studentApplication, teacherRequest] = await Promise.all([
    env.DB.prepare('SELECT * FROM student_applications WHERE uid = ?')
      .bind(context.identity.uid).first(),
    env.DB.prepare('SELECT * FROM teacher_requests WHERE uid = ?')
      .bind(context.identity.uid).first()
  ]);
  return {
    identity: context.identity,
    profile: context.profile,
    campuses,
    studentApplication,
    teacherRequest
  };
}

async function submitStudentApplication(request, env, identity) {
  const body = await request.json();
  const campus = cleanText(body.campus, 20);
  const name = cleanText(body.name || identity.name, 40);
  const contactLast4 = cleanText(body.contactLast4, 4);
  if (!CAMPUSES.has(campus)) fail(400, '소속관을 선택하세요.');
  if (name.length < 2) fail(400, '학생 이름을 2자 이상 입력하세요.');
  if (!/^\d{4}$/.test(contactLast4)) {
    fail(400, '연락처 뒤 4자리를 숫자로 입력하세요.');
  }

  const currentProfile = await getProfile(env, identity.uid);
  if (currentProfile?.role === 'master' || currentProfile?.role === 'teacher') {
    fail(409, '교사·마스터 계정은 학생 가입을 신청할 수 없습니다.');
  }
  const existing = await env.DB.prepare(
    'SELECT status FROM student_applications WHERE uid = ?'
  ).bind(identity.uid).first();
  if (existing?.status === 'approved') fail(409, '이미 승인된 학생 계정입니다.');

  const time = nowIso();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO users (uid,email,name,role,active,created_at,updated_at)
      VALUES (?,?,?,?,0,?,?)
      ON CONFLICT(uid) DO UPDATE SET
        email=excluded.email,
        name=excluded.name,
        updated_at=excluded.updated_at
    `).bind(identity.uid, identity.email, name, 'pending', time, time),
    env.DB.prepare(`
      INSERT INTO student_applications
        (uid,email,name,campus,contact_last4,status,requested_at,updated_at)
      VALUES (?,?,?,?,?,'pending',?,?)
      ON CONFLICT(uid) DO UPDATE SET
        email=excluded.email,
        name=excluded.name,
        campus=excluded.campus,
        contact_last4=excluded.contact_last4,
        status='pending',
        requested_at=excluded.requested_at,
        reviewed_at=NULL,
        reviewed_by=NULL,
        assigned_student_id=NULL,
        updated_at=excluded.updated_at
    `).bind(identity.uid, identity.email, name, campus, contactLast4, time, time)
  ]);

  return { status: 'pending', campus, name };
}

async function submitTeacherRequest(request, env, identity) {
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name || identity.name, 40);
  if (name.length < 2) fail(400, '교사 이름을 2자 이상 입력하세요.');

  const currentProfile = await getProfile(env, identity.uid);
  if (currentProfile?.role === 'master' || currentProfile?.role === 'student') {
    fail(409, '마스터·학생 계정은 교사 권한을 신청할 수 없습니다.');
  }

  const time = nowIso();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO users (uid,email,name,role,active,created_at,updated_at)
      VALUES (?,?,?,?,0,?,?)
      ON CONFLICT(uid) DO UPDATE SET
        email=excluded.email,
        name=excluded.name,
        updated_at=excluded.updated_at
    `).bind(identity.uid, identity.email, name, 'pending', time, time),
    env.DB.prepare(`
      INSERT INTO teacher_requests
        (uid,email,name,status,requested_at,updated_at)
      VALUES (?,?,?,'pending',?,?)
      ON CONFLICT(uid) DO UPDATE SET
        email=excluded.email,
        name=excluded.name,
        status='pending',
        requested_at=excluded.requested_at,
        reviewed_at=NULL,
        reviewed_by=NULL,
        updated_at=excluded.updated_at
    `).bind(identity.uid, identity.email, name, time, time)
  ]);
  return { status: 'pending', name };
}

async function createQuestion(request, env, context) {
  const profile = requireActiveProfile(context);
  if (profile.role !== 'student') fail(403, '학생 계정만 새 질문을 등록할 수 있습니다.');
  if (!CAMPUSES.has(profile.campus) || !profile.student_id) {
    fail(409, '학생 소속관 또는 내부 학생번호가 완성되지 않았습니다.');
  }

  const form = await request.formData();
  const subject = cleanText(form.get('subject'), 20);
  const body = cleanText(form.get('text'), 3000);
  const files = filesFromForm(form);
  if (!SUBJECTS.has(subject)) fail(400, '질문 과목을 확인하세요.');
  if (body.length < 2) fail(400, '질문 내용을 2자 이상 입력하세요.');

  const questionId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const time = nowIso();
  let uploaded = [];

  try {
    uploaded = await validateAndUploadFiles({
      env,
      files,
      campus: profile.campus,
      questionId,
      messageId,
      uploader: profile,
      createdAt: new Date(time)
    });

    const statements = [
      env.DB.prepare(`
        INSERT INTO questions
          (id,student_uid,student_id,student_name,campus,subject,status,last_message_at,last_message_role,created_at,updated_at)
        VALUES (?,?,?,?,?,?,'waiting_teacher',?,'student',?,?)
      `).bind(
        questionId,
        profile.uid,
        profile.student_id,
        profile.name,
        profile.campus,
        subject,
        time,
        time,
        time
      ),
      env.DB.prepare(`
        INSERT INTO messages (id,question_id,author_uid,author_role,body,created_at)
        VALUES (?,?,?,?,?,?)
      `).bind(messageId, questionId, profile.uid, 'student', body, time)
    ];

    for (const file of uploaded) {
      statements.push(env.DB.prepare(`
        INSERT INTO attachments
          (id,question_id,message_id,uploader_uid,uploader_role,object_key,original_name,content_type,size_bytes,sha256,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        file.id,
        questionId,
        messageId,
        profile.uid,
        'student',
        file.objectKey,
        file.originalName,
        file.contentType,
        file.sizeBytes,
        file.sha256,
        time
      ));
    }

    await env.DB.batch(statements);
    return {
      questionId,
      messageId,
      status: 'waiting_teacher',
      attachments: uploaded.length
    };
  } catch (error) {
    await deleteUploaded(env, uploaded);
    throw error;
  }
}

async function listQuestions(env, profile) {
  if (profile.role === 'student') {
    return (await env.DB.prepare(`
      SELECT * FROM questions
      WHERE student_uid = ?
      ORDER BY last_message_at DESC
      LIMIT 200
    `).bind(profile.uid).all()).results;
  }
  if (profile.role === 'master') {
    return (await env.DB.prepare(`
      SELECT * FROM questions
      ORDER BY last_message_at DESC
      LIMIT 500
    `).all()).results;
  }
  if (profile.role === 'teacher' && profile.can_answer_questions === 1) {
    const campuses = await getTeacherCampuses(env, profile.uid);
    if (!campuses.length) return [];
    const placeholders = campuses.map(() => '?').join(',');
    return (await env.DB.prepare(`
      SELECT * FROM questions
      WHERE campus IN (${placeholders})
      ORDER BY last_message_at DESC
      LIMIT 500
    `).bind(...campuses).all()).results;
  }
  fail(403, '질문을 열람할 권한이 없습니다.');
}

async function listMessages(env, questionId) {
  const messages = (await env.DB.prepare(`
    SELECT * FROM messages
    WHERE question_id = ?
    ORDER BY created_at ASC
  `).bind(questionId).all()).results;
  const attachments = (await env.DB.prepare(`
    SELECT id,message_id,original_name,content_type,size_bytes,created_at
    FROM attachments
    WHERE question_id = ? AND deleted_at IS NULL
    ORDER BY created_at ASC
  `).bind(questionId).all()).results;

  const byMessage = new Map();
  for (const attachment of attachments) {
    const list = byMessage.get(attachment.message_id) || [];
    list.push({ ...attachment, url: `/api/attachments/${attachment.id}` });
    byMessage.set(attachment.message_id, list);
  }
  return messages.map((message) => ({
    ...message,
    attachments: byMessage.get(message.id) || []
  }));
}

async function addMessage(request, env, context, question) {
  const profile = requireActiveProfile(context);
  if (question.status === 'closed') {
    fail(409, '종료된 질문입니다. 먼저 질문을 다시 열어야 합니다.');
  }
  if (!['student', 'teacher', 'master'].includes(profile.role)) {
    fail(403, '메시지를 전송할 권한이 없습니다.');
  }
  if (profile.role === 'student' && question.student_uid !== profile.uid) {
    fail(403, '자기 질문에만 메시지를 보낼 수 있습니다.');
  }
  if (profile.role === 'teacher' && profile.can_answer_questions !== 1) {
    fail(403, '질문 답변 권한이 없습니다.');
  }

  const form = await request.formData();
  const body = cleanText(form.get('text'), 3000);
  const files = filesFromForm(form);
  if (body.length < 2) fail(400, '메시지 내용을 2자 이상 입력하세요.');

  const messageId = crypto.randomUUID();
  const time = nowIso();
  const messageRole = profile.role === 'master' ? 'master' : profile.role;
  const nextStatus = messageRole === 'student' ? 'waiting_teacher' : 'waiting_student';
  let uploaded = [];

  try {
    uploaded = await validateAndUploadFiles({
      env,
      files,
      campus: question.campus,
      questionId: question.id,
      messageId,
      uploader: profile,
      createdAt: new Date(time)
    });

    const statements = [
      env.DB.prepare(`
        INSERT INTO messages (id,question_id,author_uid,author_role,body,created_at)
        VALUES (?,?,?,?,?,?)
      `).bind(messageId, question.id, profile.uid, messageRole, body, time),
      env.DB.prepare(`
        UPDATE questions
        SET status=?,last_message_at=?,last_message_role=?,updated_at=?
        WHERE id=?
      `).bind(nextStatus, time, messageRole, time, question.id)
    ];

    for (const file of uploaded) {
      statements.push(env.DB.prepare(`
        INSERT INTO attachments
          (id,question_id,message_id,uploader_uid,uploader_role,object_key,original_name,content_type,size_bytes,sha256,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        file.id,
        question.id,
        messageId,
        profile.uid,
        messageRole,
        file.objectKey,
        file.originalName,
        file.contentType,
        file.sizeBytes,
        file.sha256,
        time
      ));
    }

    await env.DB.batch(statements);
    return {
      messageId,
      status: nextStatus,
      attachments: uploaded.length
    };
  } catch (error) {
    await deleteUploaded(env, uploaded);
    throw error;
  }
}

async function serveAttachment(request, env, profile, attachmentId) {
  const row = await env.DB.prepare(`
    SELECT a.*,q.student_uid,q.campus AS question_campus
    FROM attachments a
    JOIN questions q ON q.id=a.question_id
    WHERE a.id=? AND a.deleted_at IS NULL
  `).bind(attachmentId).first();
  if (!row) fail(404, '사진을 찾을 수 없습니다.');

  const question = await getQuestion(env, row.question_id);
  if (!(await canReadQuestion(env, profile, question))) {
    fail(403, '이 사진을 열람할 권한이 없습니다.');
  }

  const object = await env.ATTACHMENTS.get(row.object_key);
  if (!object || !object.body) fail(404, '사진 원본이 저장소에 없습니다.');
  return new Response(object.body, {
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': row.content_type,
      'Content-Length': String(row.size_bytes),
      'Cache-Control': 'private, max-age=300',
      'ETag': object.httpEtag
    }
  });
}

async function closeQuestion(env, profile, question) {
  if (!['teacher', 'master'].includes(profile.role)) {
    fail(403, '교사 또는 마스터만 질문을 종료할 수 있습니다.');
  }
  const time = nowIso();
  await env.DB.prepare(`
    UPDATE questions
    SET status='closed',closed_at=?,closed_by=?,updated_at=?
    WHERE id=?
  `).bind(time, profile.uid, time, question.id).run();
  await audit(env, profile.uid, 'question.close', 'question', question.id, question.campus);
  return { questionId: question.id, status: 'closed' };
}

async function reopenQuestion(env, profile, question) {
  if (!['teacher', 'master'].includes(profile.role)) {
    fail(403, '교사 또는 마스터만 질문을 다시 열 수 있습니다.');
  }
  const nextStatus = question.last_message_role === 'student'
    ? 'waiting_teacher'
    : 'waiting_student';
  const time = nowIso();
  await env.DB.prepare(`
    UPDATE questions
    SET status=?,closed_at=NULL,closed_by=NULL,updated_at=?
    WHERE id=?
  `).bind(nextStatus, time, question.id).run();
  await audit(env, profile.uid, 'question.reopen', 'question', question.id, question.campus);
  return { questionId: question.id, status: nextStatus };
}

async function listStudents(env, profile) {
  let rows;
  if (profile.role === 'master') {
    rows = (await env.DB.prepare(`
      SELECT uid,email,name,campus,student_id,active,created_at,updated_at
      FROM users
      WHERE role='student'
      ORDER BY campus,student_id,name
    `).all()).results;
  } else {
    const campuses = await getTeacherCampuses(env, profile.uid);
    if (!campuses.length) return [];
    const placeholders = campuses.map(() => '?').join(',');
    rows = (await env.DB.prepare(`
      SELECT uid,email,name,campus,student_id,active,created_at,updated_at
      FROM users
      WHERE role='student' AND campus IN (${placeholders})
      ORDER BY campus,student_id,name
    `).bind(...campuses).all()).results;
  }

  const counts = (await env.DB.prepare(`
    SELECT student_uid,
      COUNT(*) AS total_questions,
      SUM(CASE WHEN status='waiting_teacher' THEN 1 ELSE 0 END) AS waiting_teacher,
      SUM(CASE WHEN status='waiting_student' THEN 1 ELSE 0 END) AS waiting_student,
      SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed
    FROM questions
    GROUP BY student_uid
  `).all()).results;
  const countMap = new Map(counts.map((row) => [row.student_uid, row]));
  return rows.map((row) => ({
    ...row,
    counts: countMap.get(row.uid) || {
      total_questions: 0,
      waiting_teacher: 0,
      waiting_student: 0,
      closed: 0
    }
  }));
}

async function listStudentApplications(env, profile) {
  const campuses = await allowedCampusesForApprover(env, profile);
  if (!campuses.length) return [];
  const placeholders = campuses.map(() => '?').join(',');
  return (await env.DB.prepare(`
    SELECT *
    FROM student_applications
    WHERE campus IN (${placeholders})
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
      requested_at DESC
    LIMIT 300
  `).bind(...campuses).all()).results;
}

async function approveStudent(request, env, context, uid) {
  const reviewer = requireActiveProfile(context);
  const application = await env.DB.prepare(
    'SELECT * FROM student_applications WHERE uid = ?'
  ).bind(uid).first();
  if (!application) fail(404, '학생 가입 신청을 찾을 수 없습니다.');

  const allowed = await allowedCampusesForApprover(env, reviewer);
  if (!allowed.includes(application.campus)) {
    fail(403, '이 소속관 학생을 승인할 권한이 없습니다.');
  }

  const body = await request.json();
  const studentId = validateStudentId(application.campus, body.studentId);
  const time = nowIso();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE users
      SET email=?,name=?,role='student',active=1,campus=?,student_id=?,
          can_answer_questions=0,can_approve_students=0,can_manage_student_info=0,
          updated_at=?
      WHERE uid=?
    `).bind(
      application.email,
      application.name,
      application.campus,
      studentId,
      time,
      uid
    ),
    env.DB.prepare(`
      UPDATE student_applications
      SET status='approved',assigned_student_id=?,reviewed_at=?,reviewed_by=?,updated_at=?
      WHERE uid=?
    `).bind(studentId, time, reviewer.uid, time, uid)
  ]);
  await audit(env, reviewer.uid, 'student.approve', 'user', uid, application.campus, {
    studentId
  });
  return { uid, status: 'approved', campus: application.campus, studentId };
}

async function rejectStudent(request, env, context, uid) {
  const reviewer = requireActiveProfile(context);
  const application = await env.DB.prepare(
    'SELECT * FROM student_applications WHERE uid = ?'
  ).bind(uid).first();
  if (!application) fail(404, '학생 가입 신청을 찾을 수 없습니다.');

  const allowed = await allowedCampusesForApprover(env, reviewer);
  if (!allowed.includes(application.campus)) {
    fail(403, '이 소속관 학생을 반려할 권한이 없습니다.');
  }

  const body = await request.json().catch(() => ({}));
  const reason = cleanText(body.reason, 300);
  const time = nowIso();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE users
      SET role='pending',active=0,campus=NULL,student_id=NULL,updated_at=?
      WHERE uid=?
    `).bind(time, uid),
    env.DB.prepare(`
      UPDATE student_applications
      SET status='rejected',assigned_student_id=NULL,reviewed_at=?,reviewed_by=?,updated_at=?
      WHERE uid=?
    `).bind(time, reviewer.uid, time, uid)
  ]);
  await audit(env, reviewer.uid, 'student.reject', 'user', uid, application.campus, {
    reason
  });
  return { uid, status: 'rejected' };
}

async function updateStudent(request, env, context, uid) {
  const manager = requireActiveProfile(context);
  const current = await env.DB.prepare(
    "SELECT * FROM users WHERE uid=? AND role='student'"
  ).bind(uid).first();
  if (!current) fail(404, '학생 계정을 찾을 수 없습니다.');

  const allowed = await allowedCampusesForStudentManager(env, manager);
  if (!allowed.includes(current.campus)) {
    fail(403, '이 학생 정보를 수정할 권한이 없습니다.');
  }

  const body = await request.json();
  const campus = cleanText(body.campus || current.campus, 20);
  if (!CAMPUSES.has(campus)) fail(400, '소속관을 확인하세요.');
  if (manager.role !== 'master' && !allowed.includes(campus)) {
    fail(403, '관리 권한이 없는 소속관으로 변경할 수 없습니다.');
  }
  const studentId = validateStudentId(campus, body.studentId || current.student_id);
  const name = cleanText(body.name || current.name, 40);
  if (name.length < 2) fail(400, '학생 이름을 2자 이상 입력하세요.');
  const active = toFlag(body.active);
  const time = nowIso();

  await env.DB.prepare(`
    UPDATE users
    SET name=?,campus=?,student_id=?,active=?,updated_at=?
    WHERE uid=?
  `).bind(name, campus, studentId, active, time, uid).run();
  await audit(env, manager.uid, 'student.update', 'user', uid, campus, {
    studentId,
    active
  });
  return { uid, name, campus, studentId, active };
}

async function listTeacherRequests(env, context) {
  requireMaster(context);
  return (await env.DB.prepare(`
    SELECT *
    FROM teacher_requests
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
      requested_at DESC
    LIMIT 300
  `).all()).results;
}

async function approveTeacher(request, env, context, uid) {
  const master = requireMaster(context);
  const teacherRequest = await env.DB.prepare(
    'SELECT * FROM teacher_requests WHERE uid = ?'
  ).bind(uid).first();
  if (!teacherRequest) fail(404, '교사 권한 요청을 찾을 수 없습니다.');

  const body = await request.json();
  const campuses = uniqueCampuses(body.campuses);
  if (!campuses.length) fail(400, '교사가 관리할 소속관을 하나 이상 선택하세요.');

  const canAnswer = toFlag(body.canAnswerQuestions);
  const canApprove = toFlag(body.canApproveStudents);
  const canManage = toFlag(body.canManageStudentInfo);
  const time = nowIso();
  const statements = [
    env.DB.prepare(`
      UPDATE users
      SET email=?,name=?,role='teacher',active=1,campus=NULL,student_id=NULL,
          can_answer_questions=?,can_approve_students=?,can_manage_student_info=?,
          updated_at=?
      WHERE uid=?
    `).bind(
      teacherRequest.email,
      teacherRequest.name,
      canAnswer,
      canApprove,
      canManage,
      time,
      uid
    ),
    env.DB.prepare(`
      UPDATE teacher_requests
      SET status='approved',reviewed_at=?,reviewed_by=?,updated_at=?
      WHERE uid=?
    `).bind(time, master.uid, time, uid),
    env.DB.prepare('DELETE FROM teacher_campuses WHERE teacher_uid=?').bind(uid)
  ];
  for (const campus of campuses) {
    statements.push(env.DB.prepare(`
      INSERT INTO teacher_campuses (teacher_uid,campus,created_at)
      VALUES (?,?,?)
    `).bind(uid, campus, time));
  }
  await env.DB.batch(statements);
  await audit(env, master.uid, 'teacher.approve', 'user', uid, null, {
    campuses,
    canAnswer,
    canApprove,
    canManage
  });
  return {
    uid,
    status: 'approved',
    campuses,
    canAnswerQuestions: canAnswer,
    canApproveStudents: canApprove,
    canManageStudentInfo: canManage
  };
}

async function rejectTeacher(request, env, context, uid) {
  const master = requireMaster(context);
  const teacherRequest = await env.DB.prepare(
    'SELECT * FROM teacher_requests WHERE uid = ?'
  ).bind(uid).first();
  if (!teacherRequest) fail(404, '교사 권한 요청을 찾을 수 없습니다.');

  const body = await request.json().catch(() => ({}));
  const reason = cleanText(body.reason, 300);
  const time = nowIso();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE users
      SET role='pending',active=0,
          can_answer_questions=0,can_approve_students=0,can_manage_student_info=0,
          updated_at=?
      WHERE uid=?
    `).bind(time, uid),
    env.DB.prepare(`
      UPDATE teacher_requests
      SET status='rejected',reviewed_at=?,reviewed_by=?,updated_at=?
      WHERE uid=?
    `).bind(time, master.uid, time, uid),
    env.DB.prepare('DELETE FROM teacher_campuses WHERE teacher_uid=?').bind(uid)
  ]);
  await audit(env, master.uid, 'teacher.reject', 'user', uid, null, { reason });
  return { uid, status: 'rejected' };
}

async function listTeachers(env, context) {
  requireMaster(context);
  const teachers = (await env.DB.prepare(`
    SELECT uid,email,name,active,
      can_answer_questions,can_approve_students,can_manage_student_info,
      created_at,updated_at
    FROM users
    WHERE role='teacher'
    ORDER BY active DESC,name,email
  `).all()).results;
  const campusRows = (await env.DB.prepare(`
    SELECT teacher_uid,campus
    FROM teacher_campuses
    ORDER BY campus
  `).all()).results;
  const campusMap = new Map();
  for (const row of campusRows) {
    const list = campusMap.get(row.teacher_uid) || [];
    list.push(row.campus);
    campusMap.set(row.teacher_uid, list);
  }
  return teachers.map((teacher) => ({
    ...teacher,
    campuses: campusMap.get(teacher.uid) || []
  }));
}

async function updateTeacher(request, env, context, uid) {
  const master = requireMaster(context);
  const current = await env.DB.prepare(
    "SELECT * FROM users WHERE uid=? AND role='teacher'"
  ).bind(uid).first();
  if (!current) fail(404, '승인된 교사 계정을 찾을 수 없습니다.');

  const body = await request.json();
  const campuses = uniqueCampuses(body.campuses);
  if (!campuses.length) fail(400, '교사가 관리할 소속관을 하나 이상 선택하세요.');
  const active = toFlag(body.active);
  const canAnswer = toFlag(body.canAnswerQuestions);
  const canApprove = toFlag(body.canApproveStudents);
  const canManage = toFlag(body.canManageStudentInfo);
  const name = cleanText(body.name || current.name, 40);
  const time = nowIso();

  const statements = [
    env.DB.prepare(`
      UPDATE users
      SET name=?,active=?,can_answer_questions=?,can_approve_students=?,
          can_manage_student_info=?,updated_at=?
      WHERE uid=?
    `).bind(name, active, canAnswer, canApprove, canManage, time, uid),
    env.DB.prepare('DELETE FROM teacher_campuses WHERE teacher_uid=?').bind(uid)
  ];
  for (const campus of campuses) {
    statements.push(env.DB.prepare(`
      INSERT INTO teacher_campuses (teacher_uid,campus,created_at)
      VALUES (?,?,?)
    `).bind(uid, campus, time));
  }
  await env.DB.batch(statements);
  await audit(env, master.uid, 'teacher.update', 'user', uid, null, {
    campuses,
    active,
    canAnswer,
    canApprove,
    canManage
  });
  return {
    uid,
    name,
    active,
    campuses,
    canAnswerQuestions: canAnswer,
    canApproveStudents: canApprove,
    canManageStudentInfo: canManage
  };
}

async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, env)
    });
  }
  if (request.method === 'GET' && url.pathname === '/health') {
    return json(request, env, {
      ok: true,
      service: 'etoos247-qa-api',
      storagePathVersion: 'qa/v1',
      appVersion: 'unified-20260807'
    });
  }

  const context = await authContext(request, env);

  if (request.method === 'GET' && url.pathname === '/api/me') {
    return json(request, env, await getMePayload(env, context));
  }
  if (request.method === 'POST' && url.pathname === '/api/student-applications') {
    return json(
      request,
      env,
      await submitStudentApplication(request, env, context.identity),
      201
    );
  }
  if (request.method === 'POST' && url.pathname === '/api/teacher-requests') {
    return json(
      request,
      env,
      await submitTeacherRequest(request, env, context.identity),
      201
    );
  }
  if (url.pathname === '/api/questions' && request.method === 'GET') {
    const profile = requireActiveProfile(context);
    return json(request, env, { questions: await listQuestions(env, profile) });
  }
  if (url.pathname === '/api/questions' && request.method === 'POST') {
    return json(request, env, await createQuestion(request, env, context), 201);
  }
  if (url.pathname === '/api/students' && request.method === 'GET') {
    const profile = requireActiveProfile(context);
    if (!['teacher', 'master'].includes(profile.role)) {
      fail(403, '교사 또는 마스터 권한이 필요합니다.');
    }
    return json(request, env, { students: await listStudents(env, profile) });
  }

  if (url.pathname === '/api/admin/student-applications' && request.method === 'GET') {
    const profile = requireActiveProfile(context);
    return json(request, env, {
      applications: await listStudentApplications(env, profile)
    });
  }
  if (url.pathname === '/api/admin/teacher-requests' && request.method === 'GET') {
    return json(request, env, {
      requests: await listTeacherRequests(env, context)
    });
  }
  if (url.pathname === '/api/admin/teachers' && request.method === 'GET') {
    return json(request, env, {
      teachers: await listTeachers(env, context)
    });
  }

  let match = /^\/api\/questions\/([^/]+)\/messages$/.exec(url.pathname);
  if (match) {
    const profile = requireActiveProfile(context);
    const question = await requireQuestionAccess(env, profile, match[1]);
    if (request.method === 'GET') {
      return json(request, env, {
        question,
        messages: await listMessages(env, question.id)
      });
    }
    if (request.method === 'POST') {
      return json(
        request,
        env,
        await addMessage(request, env, context, question),
        201
      );
    }
  }

  match = /^\/api\/questions\/([^/]+)\/close$/.exec(url.pathname);
  if (match && request.method === 'POST') {
    const profile = requireActiveProfile(context);
    const question = await requireQuestionAccess(env, profile, match[1]);
    return json(request, env, await closeQuestion(env, profile, question));
  }

  match = /^\/api\/questions\/([^/]+)\/reopen$/.exec(url.pathname);
  if (match && request.method === 'POST') {
    const profile = requireActiveProfile(context);
    const question = await requireQuestionAccess(env, profile, match[1]);
    return json(request, env, await reopenQuestion(env, profile, question));
  }

  match = /^\/api\/attachments\/([^/]+)$/.exec(url.pathname);
  if (match && request.method === 'GET') {
    const profile = requireActiveProfile(context);
    return serveAttachment(request, env, profile, match[1]);
  }

  match = /^\/api\/admin\/student-applications\/([^/]+)\/approve$/.exec(url.pathname);
  if (match && request.method === 'POST') {
    return json(
      request,
      env,
      await approveStudent(request, env, context, match[1])
    );
  }
  match = /^\/api\/admin\/student-applications\/([^/]+)\/reject$/.exec(url.pathname);
  if (match && request.method === 'POST') {
    return json(
      request,
      env,
      await rejectStudent(request, env, context, match[1])
    );
  }
  match = /^\/api\/admin\/students\/([^/]+)\/update$/.exec(url.pathname);
  if (match && request.method === 'POST') {
    return json(
      request,
      env,
      await updateStudent(request, env, context, match[1])
    );
  }
  match = /^\/api\/admin\/teacher-requests\/([^/]+)\/approve$/.exec(url.pathname);
  if (match && request.method === 'POST') {
    return json(
      request,
      env,
      await approveTeacher(request, env, context, match[1])
    );
  }
  match = /^\/api\/admin\/teacher-requests\/([^/]+)\/reject$/.exec(url.pathname);
  if (match && request.method === 'POST') {
    return json(
      request,
      env,
      await rejectTeacher(request, env, context, match[1])
    );
  }
  match = /^\/api\/admin\/teachers\/([^/]+)\/update$/.exec(url.pathname);
  if (match && request.method === 'POST') {
    return json(
      request,
      env,
      await updateTeacher(request, env, context, match[1])
    );
  }

  fail(404, '요청한 API 경로를 찾을 수 없습니다.');
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      console.error(error);
      const status = Number(error.status) || 500;
      return json(request, env, {
        error: status >= 500 ? 'server_error' : 'request_error',
        message: status >= 500
          ? '서버 처리 중 오류가 발생했습니다.'
          : error.message,
        detail: status >= 500 ? undefined : error.detail
      }, status);
    }
  }
};
