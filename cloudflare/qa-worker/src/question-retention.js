import { verifyFirebaseIdToken } from './firebase-auth.js';

const DELETE_PATH = /^\/api\/admin\/questions\/([^/]+)\/delete$/;
const DEFAULT_RETENTION_DAYS = 7;
const CLEANUP_LIMIT = 100;
const R2_DELETE_BATCH = 250;

function nowIso() {
  return new Date().toISOString();
}

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get('origin');
  const allowedOrigin = env.ALLOWED_ORIGIN;
  const origin = requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
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

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function requireMaster(request, env) {
  const identity = await verifyFirebaseIdToken(request, env);
  const profile = await env.DB.prepare(`
    SELECT * FROM users
    WHERE uid=? AND role='master' AND active=1
  `).bind(identity.uid).first();
  if (!profile) fail(403, '마스터 권한이 필요합니다.');
  return { identity, profile };
}

async function deleteR2Keys(env, keys) {
  for (let offset = 0; offset < keys.length; offset += R2_DELETE_BATCH) {
    await env.ATTACHMENTS.delete(keys.slice(offset, offset + R2_DELETE_BATCH));
  }
}

async function attachmentKeys(env, questionId) {
  const result = await env.DB.prepare(`
    SELECT object_key FROM attachments
    WHERE question_id=?
    ORDER BY created_at,id
  `).bind(questionId).all();
  return (result.results || []).map((row) => row.object_key);
}

async function writeAudit(env, actorUid, action, question, attachmentCount, detail = {}) {
  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id,actor_uid,action,target_type,target_id,campus,detail_json,created_at
    ) VALUES (?,?,?,?,?,?,?,?)
  `).bind(
    crypto.randomUUID(),
    actorUid,
    action,
    'question',
    question.id,
    question.campus,
    JSON.stringify({
      studentUid: question.student_uid,
      studentId: question.student_id,
      subject: question.subject,
      status: question.status,
      closedAt: question.closed_at,
      attachmentCount,
      ...detail
    }),
    nowIso()
  ).run();
}

async function deleteQuestion(env, question, actorUid, action, detail = {}) {
  const keys = await attachmentKeys(env, question.id);
  if (keys.length) await deleteR2Keys(env, keys);
  await env.DB.prepare('DELETE FROM questions WHERE id=?').bind(question.id).run();
  await writeAudit(env, actorUid, action, question, keys.length, detail);
  return { questionId: question.id, attachmentsDeleted: keys.length };
}

export async function handleQuestionRetention(request, env) {
  const url = new URL(request.url);
  const match = DELETE_PATH.exec(url.pathname);
  if (!match) return null;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  try {
    if (request.method !== 'POST') fail(405, 'POST 요청만 허용됩니다.');
    const master = await requireMaster(request, env);
    const questionId = decodeURIComponent(match[1]);
    const question = await env.DB.prepare(
      'SELECT * FROM questions WHERE id=?'
    ).bind(questionId).first();
    if (!question) fail(404, '삭제할 질문을 찾을 수 없습니다.');

    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || '마스터 수시 삭제').trim().slice(0, 300);
    const result = await deleteQuestion(
      env,
      question,
      master.identity.uid,
      'question.delete.manual',
      { reason }
    );
    return json(request, env, { ok: true, ...result });
  } catch (error) {
    console.error('Manual question deletion failed', error);
    return json(request, env, {
      error: Number(error.status) >= 500 ? 'server_error' : 'request_error',
      message: error.message || '질문 삭제 중 오류가 발생했습니다.'
    }, Number(error.status) || 500);
  }
}

export async function cleanupExpiredClosedQuestions(env) {
  const retentionDays = Number(
    env.QUESTION_CLOSED_RETENTION_DAYS || DEFAULT_RETENTION_DAYS
  );
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
  const result = await env.DB.prepare(`
    SELECT * FROM questions
    WHERE status='closed'
      AND closed_at IS NOT NULL
      AND closed_at<=?
    ORDER BY closed_at ASC
    LIMIT ?
  `).bind(cutoff, CLEANUP_LIMIT).all();

  let deleted = 0;
  let attachmentsDeleted = 0;
  const failures = [];

  for (const question of result.results || []) {
    try {
      const deletion = await deleteQuestion(
        env,
        question,
        null,
        'question.delete.retention',
        { retentionDays, cutoff }
      );
      deleted += 1;
      attachmentsDeleted += deletion.attachmentsDeleted;
    } catch (error) {
      console.error('Closed question retention deletion failed', question.id, error);
      failures.push({ questionId: question.id, message: error.message });
    }
  }

  return { deleted, attachmentsDeleted, retentionDays, cutoff, failures };
}
