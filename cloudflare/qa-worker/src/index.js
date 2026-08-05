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
  if (!context.profile || context.profile.active !== 1) fail(403, '승인된 활성 사용자만 이용할 수 있습니다.');
  return context.profile;
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
  if (!(await canReadQuestion(env, profile, question))) fail(403, '이 질문에 접근할 권한이 없습니다.');
  return question;
}

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function filesFromForm(form) {
  return form.getAll('images').filter((value) => value && typeof value === 'object' && 'arrayBuffer' in value);
}

async function validateAndUploadFiles({ env, files, campus, questionId, messageId, uploader, createdAt }) {
  const maxBytes = Number(env.MAX_IMAGE_BYTES || 1048576);
  const maxImages = Number(env.MAX_IMAGES_PER_MESSAGE || 3);
  if (files.length > maxImages) fail(400, `사진은 한 메시지당 최대 ${maxImages}장까지 첨부할 수 있습니다.`);

  const rows = [];
  for (const file of files) {
    if (!IMAGE_TYPES.has(file.type)) fail(400, 'JPG·PNG·WebP 사진만 첨부할 수 있습니다.');
    if (!file.size || file.size > maxBytes) fail(400, '사진 한 장은 압축 후 1MB 이하여야 합니다.');

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
    const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');

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

async function submitStudentApplication(request, env, identity) {
  const body = await request.json();
  const campus = cleanText(body.campus, 20);
  const name = cleanText(body.name || identity.name, 40);
  const contactLast4 = cleanText(body.contactLast4, 4);
  if (!CAMPUSES.has(campus)) fail(400, '소속관을 선택하세요.');
  if (name.length < 2) fail(400, '학생 이름을 2자 이상 입력하세요.');
  if (!/^\d{4}$/.test(contactLast4)) fail(400, '연락처 뒤 4자리를 숫자로 입력하세요.');

  const existing = await env.DB.prepare('SELECT status FROM student_applications WHERE uid = ?').bind(identity.uid).first();
  if (existing?.status === 'approved') fail(409, '이미 승인된 학생 계정입니다.');

  const time = nowIso();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO users (uid,email,name,role,active,created_at,updated_at)
      VALUES (?,?,?,?,0,?,?)
      ON CONFLICT(uid) DO UPDATE SET email=excluded.email,name=excluded.name,updated_at=excluded.updated_at
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
        updated_at=excluded.updated_at
    `).bind(identity.uid, identity.email, name, campus, contactLast4, time, time)
  ]);

  return { status: 'pending', campus, name };
}

async function createQuestion(request, env, context) {
  const profile = requireActiveProfile(context);
  if (profile.role !== 'student') fail(403, '학생 계정만 새 질문을 등록할 수 있습니다.');
  if (!CAMPUSES.has(profile.campus) || !profile.student_id) fail(409, '학생 소속관 또는 내부 학생번호가 완성되지 않았습니다.');

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
      `).bind(questionId, profile.uid, profile.student_id, profile.name, profile.campus, subject, time, time, time),
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
      `).bind(file.id, questionId, messageId, profile.uid, 'student', file.objectKey, file.originalName, file.contentType, file.sizeBytes, file.sha256, time));
    }

    await env.DB.batch(statements);
    return { questionId, messageId, status: 'waiting_teacher', attachments: uploaded.length };
  } catch (error) {
    await deleteUploaded(env, uploaded);
    throw error;
  }
}

async function listQuestions(env, profile) {
  if (profile.role === 'student') {
    return (await env.DB.prepare(`
      SELECT * FROM questions WHERE student_uid = ? ORDER BY last_message_at DESC LIMIT 200
    `).bind(profile.uid).all()).results;
  }
  if (profile.role === 'master') {
    return (await env.DB.prepare('SELECT * FROM questions ORDER BY last_message_at DESC LIMIT 500').all()).results;
  }
  if (profile.role === 'teacher' && profile.can_answer_questions === 1) {
    const campuses = await getTeacherCampuses(env, profile.uid);
    if (!campuses.length) return [];
    const placeholders = campuses.map(() => '?').join(',');
    return (await env.DB.prepare(`
      SELECT * FROM questions WHERE campus IN (${placeholders}) ORDER BY last_message_at DESC LIMIT 500
    `).bind(...campuses).all()).results;
  }
  fail(403, '질문을 열람할 권한이 없습니다.');
}

async function listMessages(env, questionId) {
  const messages = (await env.DB.prepare(`
    SELECT * FROM messages WHERE question_id = ? ORDER BY created_at ASC
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
  return messages.map((message) => ({ ...message, attachments: byMessage.get(message.id) || [] }));
}

async function addMessage(request, env, context, question) {
  const profile = requireActiveProfile(context);
  if (question.status === 'closed') fail(409, '종료된 질문입니다. 먼저 질문을 다시 열어야 합니다.');
  if (!['student', 'teacher', 'master'].includes(profile.role)) fail(403, '메시지를 전송할 권한이 없습니다.');

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
        UPDATE questions SET status=?,last_message_at=?,last_message_role=?,updated_at=? WHERE id=?
      `).bind(nextStatus, time, messageRole, time, question.id)
    ];

    for (const file of uploaded) {
      statements.push(env.DB.prepare(`
        INSERT INTO attachments
          (id,question_id,message_id,uploader_uid,uploader_role,object_key,original_name,content_type,size_bytes,sha256,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).bind(file.id, question.id, messageId, profile.uid, messageRole, file.objectKey, file.originalName, file.contentType, file.sizeBytes, file.sha256, time));
    }

    await env.DB.batch(statements);
    return { messageId, status: nextStatus, attachments: uploaded.length };
  } catch (error) {
    await deleteUploaded(env, uploaded);
    throw error;
  }
}

async function serveAttachment(request, env, profile, attachmentId) {
  const row = await env.DB.prepare(`
    SELECT a.*,q.student_uid,q.campus AS question_campus
    FROM attachments a JOIN questions q ON q.id=a.question_id
    WHERE a.id=? AND a.deleted_at IS NULL
  `).bind(attachmentId).first();
  if (!row) fail(404, '사진을 찾을 수 없습니다.');
  const question = await getQuestion(env, row.question_id);
  if (!(await canReadQuestion(env, profile, question))) fail(403, '이 사진을 열람할 권한이 없습니다.');

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
  if (!['teacher', 'master'].includes(profile.role)) fail(403, '교사 또는 마스터만 질문을 종료할 수 있습니다.');
  const time = nowIso();
  await env.DB.prepare(`
    UPDATE questions SET status='closed',closed_at=?,closed_by=?,updated_at=? WHERE id=?
  `).bind(time, profile.uid, time, question.id).run();
  return { questionId: question.id, status: 'closed' };
}

async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  if (request.method === 'GET' && url.pathname === '/health') {
    return json(request, env, { ok: true, service: 'etoos247-qa-api', storagePathVersion: 'qa/v1' });
  }

  const context = await authContext(request, env);

  if (request.method === 'GET' && url.pathname === '/api/me') {
    return json(request, env, { identity: context.identity, profile: context.profile });
  }
  if (request.method === 'POST' && url.pathname === '/api/student-applications') {
    return json(request, env, await submitStudentApplication(request, env, context.identity), 201);
  }
  if (url.pathname === '/api/questions' && request.method === 'GET') {
    const profile = requireActiveProfile(context);
    return json(request, env, { questions: await listQuestions(env, profile) });
  }
  if (url.pathname === '/api/questions' && request.method === 'POST') {
    return json(request, env, await createQuestion(request, env, context), 201);
  }

  let match = /^\/api\/questions\/([^/]+)\/messages$/.exec(url.pathname);
  if (match) {
    const profile = requireActiveProfile(context);
    const question = await requireQuestionAccess(env, profile, match[1]);
    if (request.method === 'GET') return json(request, env, { question, messages: await listMessages(env, question.id) });
    if (request.method === 'POST') return json(request, env, await addMessage(request, env, context, question), 201);
  }

  match = /^\/api\/questions\/([^/]+)\/close$/.exec(url.pathname);
  if (match && request.method === 'POST') {
    const profile = requireActiveProfile(context);
    const question = await requireQuestionAccess(env, profile, match[1]);
    return json(request, env, await closeQuestion(env, profile, question));
  }

  match = /^\/api\/attachments\/([^/]+)$/.exec(url.pathname);
  if (match && request.method === 'GET') {
    const profile = requireActiveProfile(context);
    return serveAttachment(request, env, profile, match[1]);
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
        message: status >= 500 ? '서버 처리 중 오류가 발생했습니다.' : error.message,
        detail: status >= 500 ? undefined : error.detail
      }, status);
    }
  }
};
