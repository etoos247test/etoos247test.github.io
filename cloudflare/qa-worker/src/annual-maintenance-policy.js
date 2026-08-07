import {
  cleanupExpiredAnnualArchives as cleanupBaseArchives,
  handleAnnualMaintenance as handleBaseAnnualMaintenance
} from './annual-maintenance.js';

const PREPARE_RESET = '/api/admin/annual-maintenance/prepare-reset';
const EXECUTE_RESET = '/api/admin/annual-maintenance/execute-reset';
const PREPARE_RESTORE = '/api/admin/annual-maintenance/prepare-restore';
const EXECUTE_RESTORE = '/api/admin/annual-maintenance/execute-restore';

async function snapshotApprovedTeachers(env) {
  const teachers = (await env.DB.prepare(`
    SELECT * FROM users
    WHERE role='teacher'
    ORDER BY uid
  `).all()).results || [];

  if (!teachers.length) {
    return { teachers: [], campuses: [], requests: [] };
  }

  const uids = teachers.map((row) => row.uid);
  const placeholders = uids.map(() => '?').join(',');
  const campuses = (await env.DB.prepare(`
    SELECT * FROM teacher_campuses
    WHERE teacher_uid IN (${placeholders})
    ORDER BY teacher_uid,campus
  `).bind(...uids).all()).results || [];
  const requests = (await env.DB.prepare(`
    SELECT * FROM teacher_requests
    WHERE uid IN (${placeholders}) AND status='approved'
    ORDER BY uid
  `).bind(...uids).all()).results || [];

  return { teachers, campuses, requests };
}

async function attachTeacherSnapshot(env, operationId, snapshot) {
  if (!operationId) return;
  const row = await env.DB.prepare(
    'SELECT detail_json FROM audit_logs WHERE id=?'
  ).bind(operationId).first();
  if (!row) return;
  const detail = JSON.parse(row.detail_json || '{}');
  detail.preservedApprovedTeachers = snapshot;
  detail.preservedTeacherCount = snapshot.teachers.length;
  await env.DB.prepare(
    'UPDATE audit_logs SET detail_json=? WHERE id=?'
  ).bind(JSON.stringify(detail), operationId).run();
}

async function operationSnapshot(env, operationId) {
  if (!operationId) return null;
  const row = await env.DB.prepare(
    'SELECT detail_json FROM audit_logs WHERE id=?'
  ).bind(operationId).first();
  if (!row) return null;
  return JSON.parse(row.detail_json || '{}').preservedApprovedTeachers || null;
}

async function restoreApprovedTeachers(env, snapshot, deactivateHistoricalTeachers = false) {
  if (!snapshot?.teachers?.length) return;

  const currentUids = snapshot.teachers.map((row) => row.uid);
  const placeholders = currentUids.map(() => '?').join(',');

  if (deactivateHistoricalTeachers) {
    await env.DB.prepare(`
      UPDATE users
      SET active=0,
          can_answer_questions=0,
          can_approve_students=0,
          can_manage_student_info=0,
          updated_at=?
      WHERE role='teacher' AND uid NOT IN (${placeholders})
    `).bind(new Date().toISOString(), ...currentUids).run();
  }

  const statements = [];
  for (const row of snapshot.teachers) {
    statements.push(env.DB.prepare(`
      INSERT INTO users (
        uid,email,name,role,active,campus,student_id,
        can_answer_questions,can_approve_students,can_manage_student_info,
        created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(uid) DO UPDATE SET
        email=excluded.email,
        name=excluded.name,
        role='teacher',
        active=excluded.active,
        campus=NULL,
        student_id=NULL,
        can_answer_questions=excluded.can_answer_questions,
        can_approve_students=excluded.can_approve_students,
        can_manage_student_info=excluded.can_manage_student_info,
        updated_at=excluded.updated_at
    `).bind(
      row.uid,
      row.email,
      row.name,
      'teacher',
      row.active,
      null,
      null,
      row.can_answer_questions,
      row.can_approve_students,
      row.can_manage_student_info,
      row.created_at,
      row.updated_at
    ));
  }

  for (const uid of currentUids) {
    statements.push(
      env.DB.prepare('DELETE FROM teacher_campuses WHERE teacher_uid=?').bind(uid)
    );
  }

  for (const row of snapshot.campuses || []) {
    statements.push(env.DB.prepare(`
      INSERT OR REPLACE INTO teacher_campuses (teacher_uid,campus,created_at)
      VALUES (?,?,?)
    `).bind(row.teacher_uid, row.campus, row.created_at));
  }

  for (const row of snapshot.requests || []) {
    statements.push(env.DB.prepare(`
      INSERT OR REPLACE INTO teacher_requests (
        uid,email,name,status,requested_at,reviewed_at,reviewed_by,updated_at
      ) VALUES (?,?,?,?,?,?,?,?)
    `).bind(
      row.uid,
      row.email,
      row.name,
      row.status,
      row.requested_at,
      row.reviewed_at,
      row.reviewed_by,
      row.updated_at
    ));
  }

  if (statements.length) await env.DB.batch(statements);
}

async function parseRequestBody(request) {
  return request.clone().json().catch(() => ({}));
}

async function parseResponse(response) {
  return response.clone().json().catch(() => null);
}

export async function handleAnnualMaintenance(request, env) {
  const url = new URL(request.url);
  const isPrepare = request.method === 'POST'
    && (url.pathname === PREPARE_RESET || url.pathname === PREPARE_RESTORE);
  const isExecuteReset = request.method === 'POST' && url.pathname === EXECUTE_RESET;
  const isExecuteRestore = request.method === 'POST' && url.pathname === EXECUTE_RESTORE;

  let snapshot = null;
  let operationId = null;

  if (isPrepare) snapshot = await snapshotApprovedTeachers(env);
  if (isExecuteReset || isExecuteRestore) {
    const body = await parseRequestBody(request);
    operationId = String(body.operationId || '').trim();
    snapshot = await operationSnapshot(env, operationId);
    if (!snapshot && isExecuteReset) snapshot = await snapshotApprovedTeachers(env);
  }

  const response = await handleBaseAnnualMaintenance(request, env);
  if (!response) return null;

  const data = await parseResponse(response);
  if (response.ok && data?.operationId && isPrepare) {
    await attachTeacherSnapshot(env, data.operationId, snapshot);
  }

  if (response.ok && data?.done === true && isExecuteReset) {
    await restoreApprovedTeachers(env, snapshot, false);
  }

  if (response.ok && data?.done === true && isExecuteRestore) {
    await restoreApprovedTeachers(env, snapshot, true);
  }

  return response;
}

export async function cleanupExpiredAnnualArchives(env) {
  return cleanupBaseArchives(env);
}
