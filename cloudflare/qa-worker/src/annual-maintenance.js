import { verifyFirebaseIdToken } from './firebase-auth.js';

const API_PREFIX = '/api/admin/annual-maintenance';
const OPERATION_TTL_MS = 2 * 60 * 60 * 1000;
const R2_COPY_BATCH = 8;
const R2_DELETE_BATCH = 250;
const RESTORE_ROW_BATCH = 30;
const DEFAULT_RETENTION_DAYS = 90;

const TABLE_ORDER = [
  'users',
  'teacher_campuses',
  'student_applications',
  'teacher_requests',
  'questions',
  'messages',
  'attachments',
  'audit_logs'
];

const TABLE_COLUMNS = {
  users: [
    'uid', 'email', 'name', 'role', 'active', 'campus', 'student_id',
    'can_answer_questions', 'can_approve_students', 'can_manage_student_info',
    'created_at', 'updated_at'
  ],
  teacher_campuses: ['teacher_uid', 'campus', 'created_at'],
  student_applications: [
    'uid', 'email', 'name', 'campus', 'contact_last4', 'status',
    'assigned_student_id', 'requested_at', 'reviewed_at', 'reviewed_by', 'updated_at'
  ],
  teacher_requests: [
    'uid', 'email', 'name', 'status', 'requested_at',
    'reviewed_at', 'reviewed_by', 'updated_at'
  ],
  questions: [
    'id', 'student_uid', 'student_id', 'student_name', 'campus', 'subject',
    'status', 'last_message_at', 'last_message_role', 'created_at', 'updated_at',
    'closed_at', 'closed_by'
  ],
  messages: [
    'id', 'question_id', 'author_uid', 'author_role', 'body', 'created_at', 'edited_at'
  ],
  attachments: [
    'id', 'question_id', 'message_id', 'uploader_uid', 'uploader_role',
    'object_key', 'original_name', 'content_type', 'size_bytes', 'width', 'height',
    'sha256', 'created_at', 'deleted_at'
  ],
  audit_logs: [
    'id', 'actor_uid', 'action', 'target_type', 'target_id', 'campus',
    'detail_json', 'created_at'
  ]
};

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value, maxLength = 300) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function configuredMasterUids(env) {
  return [...new Set([
    String(env.MASTER_FIREBASE_UIDS || ''),
    String(env.MASTER_FIREBASE_UID || '')
  ].join(',').split(',').map((value) => value.trim()).filter(Boolean))];
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
    Vary: 'Origin'
  };
}

function responseJson(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function requireMaster(request, env) {
  const identity = await verifyFirebaseIdToken(request, env);
  const profile = await env.DB.prepare(
    "SELECT * FROM users WHERE uid=? AND role='master' AND active=1"
  ).bind(identity.uid).first();
  if (!profile) httpError(403, '마스터 권한이 필요합니다.');
  return { identity, profile };
}

function sixDigitCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1000000).padStart(6, '0');
}

function backupIdFor(year) {
  return `${year}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function operationPhrase(kind, yearOrBackupId) {
  return kind === 'reset'
    ? `${yearOrBackupId}학년도 초기화`
    : `${yearOrBackupId} 백업 복원`;
}

async function insertOperation(env, actorUid, action, detail) {
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id,actor_uid,action,target_type,target_id,campus,detail_json,created_at
    ) VALUES (?,?,?,?,?,?,?,?)
  `).bind(
    id,
    actorUid,
    action,
    'annual_maintenance',
    id,
    null,
    JSON.stringify(detail),
    nowIso()
  ).run();
  return id;
}

async function getOperation(env, operationId, actorUid, expectedAction) {
  const row = await env.DB.prepare(`
    SELECT * FROM audit_logs
    WHERE id=? AND actor_uid=? AND action=?
  `).bind(operationId, actorUid, expectedAction).first();
  if (!row) httpError(404, '초기화 확인 기록을 찾을 수 없습니다. 1단계부터 다시 진행하세요.');
  const detail = JSON.parse(row.detail_json || '{}');
  if (Date.parse(detail.expiresAt || '') < Date.now()) {
    httpError(410, '확인 유효시간이 지났습니다. 1단계부터 다시 진행하세요.');
  }
  return { row, detail };
}

async function updateOperation(env, operationId, detail) {
  await env.DB.prepare(
    'UPDATE audit_logs SET detail_json=? WHERE id=?'
  ).bind(JSON.stringify(detail), operationId).run();
}

function verifyConfirmation(detail, body) {
  if (cleanText(body.phrase, 120) !== detail.phrase) {
    httpError(400, '확인 문구가 정확하지 않습니다.');
  }
  if (cleanText(body.code, 12) !== detail.code) {
    httpError(400, '6자리 확인번호가 정확하지 않습니다.');
  }
}

async function countTable(env, sql, ...bindings) {
  const row = await env.DB.prepare(sql).bind(...bindings).first();
  return Number(row?.count || 0);
}

async function collectCounts(env) {
  return {
    nonMasterUsers: await countTable(env, "SELECT COUNT(*) AS count FROM users WHERE role<>'master'"),
    students: await countTable(env, "SELECT COUNT(*) AS count FROM users WHERE role='student'"),
    teachers: await countTable(env, "SELECT COUNT(*) AS count FROM users WHERE role='teacher'"),
    pendingUsers: await countTable(env, "SELECT COUNT(*) AS count FROM users WHERE role='pending'"),
    studentApplications: await countTable(env, 'SELECT COUNT(*) AS count FROM student_applications'),
    teacherRequests: await countTable(env, 'SELECT COUNT(*) AS count FROM teacher_requests'),
    questions: await countTable(env, 'SELECT COUNT(*) AS count FROM questions'),
    messages: await countTable(env, 'SELECT COUNT(*) AS count FROM messages'),
    attachments: await countTable(env, 'SELECT COUNT(*) AS count FROM attachments'),
    auditLogs: await countTable(env, "SELECT COUNT(*) AS count FROM audit_logs WHERE action NOT LIKE 'annual_%'")
  };
}

async function exportTables(env) {
  const tables = {};
  for (const table of TABLE_ORDER) {
    const result = await env.DB.prepare(`SELECT * FROM ${table}`).all();
    tables[table] = result.results || [];
  }
  return tables;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function gzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function backupKeyBytes(env) {
  const raw = cleanText(env.BACKUP_ENCRYPTION_KEY, 500);
  if (!raw) httpError(503, 'BACKUP_ENCRYPTION_KEY Worker 비밀값이 설정되지 않았습니다.');
  const bytes = base64ToBytes(raw);
  if (bytes.length !== 32) httpError(500, 'BACKUP_ENCRYPTION_KEY는 32바이트 Base64 값이어야 합니다.');
  return bytes;
}

async function encryptSnapshot(env, snapshot) {
  const plain = new TextEncoder().encode(JSON.stringify(snapshot));
  const compressed = await gzip(plain);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    'raw', backupKeyBytes(env), { name: 'AES-GCM' }, false, ['encrypt']
  );
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, compressed
  ));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encrypted));
  return {
    format: 'etoos247-qa-backup',
    version: 1,
    algorithm: 'AES-256-GCM',
    compression: 'gzip',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(encrypted),
    sha256: [...digest].map((value) => value.toString(16).padStart(2, '0')).join('')
  };
}

async function decryptSnapshot(env, envelope) {
  if (envelope?.format !== 'etoos247-qa-backup' || envelope?.version !== 1) {
    httpError(400, '지원하지 않는 백업 파일 형식입니다.');
  }
  const encrypted = base64ToBytes(envelope.ciphertext);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encrypted));
  const digestHex = [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
  if (digestHex !== envelope.sha256) httpError(400, '백업 파일 무결성 확인에 실패했습니다.');
  const key = await crypto.subtle.importKey(
    'raw', backupKeyBytes(env), { name: 'AES-GCM' }, false, ['decrypt']
  );
  const compressed = new Uint8Array(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) }, key, encrypted
  ));
  const plain = await gunzip(compressed);
  return JSON.parse(new TextDecoder().decode(plain));
}

function githubConfig(env) {
  const token = cleanText(env.GITHUB_BACKUP_TOKEN, 1000);
  if (!token) httpError(503, 'GITHUB_BACKUP_TOKEN Worker 비밀값이 설정되지 않았습니다.');
  const repo = cleanText(env.GITHUB_BACKUP_REPO || 'etoos247test/etoos247test.github.io', 200);
  const branch = cleanText(env.GITHUB_BACKUP_BRANCH || 'main', 100);
  if (!repo.includes('/')) httpError(500, 'GITHUB_BACKUP_REPO 설정을 확인하세요.');
  return { token, repo, branch };
}

async function githubRequest(env, path, options = {}) {
  const { token } = githubConfig(env);
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': 'etoos247-qa-backup-worker',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    httpError(response.status, `GitHub 백업 API 오류: ${data.message || response.status}`);
  }
  return response;
}

function utf8ToBase64(value) {
  return bytesToBase64(new TextEncoder().encode(value));
}

async function saveBackupToGitHub(env, path, envelope, message) {
  const { repo, branch } = githubConfig(env);
  const body = {
    message,
    branch,
    content: utf8ToBase64(JSON.stringify(envelope))
  };
  const response = await githubRequest(
    env,
    `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );
  const data = await response.json();
  return {
    path,
    commitSha: data.commit?.sha || null,
    contentSha: data.content?.sha || null
  };
}

async function listGitHubBackups(env) {
  const { repo, branch } = githubConfig(env);
  const response = await githubRequest(
    env,
    `/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );
  const data = await response.json();
  return (data.tree || [])
    .filter((item) => item.type === 'blob' && /^backups\/qa\/\d{4}\/.+\.backup\.enc\.json$/.test(item.path))
    .sort((a, b) => b.path.localeCompare(a.path))
    .map((item) => {
      const parts = item.path.split('/');
      return {
        path: item.path,
        academicYear: parts[2],
        backupId: parts[3].replace(/\.backup\.enc\.json$/, ''),
        size: item.size || 0
      };
    });
}

async function loadBackupFromGitHub(env, path) {
  const normalized = cleanText(path, 500);
  if (!/^backups\/qa\/\d{4}\/.+\.backup\.enc\.json$/.test(normalized)) {
    httpError(400, '백업 파일 경로가 올바르지 않습니다.');
  }
  const { repo, branch } = githubConfig(env);
  const response = await githubRequest(
    env,
    `/repos/${repo}/contents/${normalized.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`,
    { headers: { Accept: 'application/vnd.github.raw+json' } }
  );
  return JSON.parse(await response.text());
}

async function prepareReset(request, env, master) {
  const body = await request.json();
  const academicYear = cleanText(body.academicYear, 4);
  if (!/^20\d{2}$/.test(academicYear)) httpError(400, '학년도를 네 자리 숫자로 입력하세요.');
  const counts = await collectCounts(env);
  const detail = {
    type: 'reset',
    academicYear,
    counts,
    phrase: operationPhrase('reset', academicYear),
    code: sixDigitCode(),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString(),
    backupId: null,
    copied: 0,
    missingObjects: [],
    backupComplete: false,
    githubPath: null,
    completedAt: null
  };
  const operationId = await insertOperation(
    env, master.identity.uid, 'annual_reset.prepare', detail
  );
  return { operationId, ...detail };
}

async function copyR2BackupBatch(env, detail) {
  const backupId = detail.backupId || backupIdFor(detail.academicYear);
  const offset = Number(detail.copied || 0);
  const result = await env.DB.prepare(`
    SELECT object_key FROM attachments
    ORDER BY created_at,id
    LIMIT ? OFFSET ?
  `).bind(R2_COPY_BATCH, offset).all();
  const rows = result.results || [];
  const missing = [...(detail.missingObjects || [])];

  for (const row of rows) {
    const sourceKey = row.object_key;
    const archiveKey = `backups/annual/${backupId}/r2/${sourceKey}`;
    const object = await env.ATTACHMENTS.get(sourceKey);
    if (!object) {
      missing.push(sourceKey);
      continue;
    }
    await env.ATTACHMENTS.put(archiveKey, object.body, {
      httpMetadata: object.httpMetadata,
      customMetadata: {
        ...(object.customMetadata || {}),
        backupId,
        sourceKey,
        archivedAt: nowIso()
      }
    });
  }

  return {
    ...detail,
    backupId,
    copied: offset + rows.length,
    missingObjects: missing
  };
}

async function finalizeBackup(env, master, detail) {
  const tables = await exportTables(env);
  const r2Objects = (tables.attachments || []).map((row) => ({
    sourceKey: row.object_key,
    archiveKey: `backups/annual/${detail.backupId}/r2/${row.object_key}`
  }));
  const snapshot = {
    format: 'etoos247-qa-snapshot',
    version: 1,
    academicYear: detail.academicYear,
    backupId: detail.backupId,
    createdAt: nowIso(),
    createdBy: master.identity.uid,
    retentionDays: Number(env.BACKUP_RETENTION_DAYS || DEFAULT_RETENTION_DAYS),
    counts: detail.counts,
    tables,
    r2: {
      archivePrefix: `backups/annual/${detail.backupId}/r2/`,
      objects: r2Objects,
      missingObjects: detail.missingObjects || []
    }
  };
  const envelope = await encryptSnapshot(env, snapshot);
  const path = `backups/qa/${detail.academicYear}/${detail.backupId}.backup.enc.json`;
  const github = await saveBackupToGitHub(
    env,
    path,
    envelope,
    `Backup QA data before ${detail.academicYear} annual reset`
  );
  return {
    ...detail,
    backupComplete: true,
    githubPath: github.path,
    githubCommitSha: github.commitSha,
    backupCompletedAt: nowIso()
  };
}

async function backupReset(request, env, master) {
  const body = await request.json();
  const operationId = cleanText(body.operationId, 80);
  const operation = await getOperation(
    env, operationId, master.identity.uid, 'annual_reset.prepare'
  );
  verifyConfirmation(operation.detail, body);
  let detail = operation.detail;
  if (detail.completedAt) httpError(409, '이미 완료된 초기화 작업입니다.');
  if (detail.backupComplete) {
    return {
      done: true,
      operationId,
      copied: detail.copied,
      total: detail.counts.attachments,
      backupId: detail.backupId,
      githubPath: detail.githubPath,
      missingObjects: detail.missingObjects || []
    };
  }

  detail = await copyR2BackupBatch(env, detail);
  const total = Number(detail.counts.attachments || 0);
  if (detail.copied >= total) detail = await finalizeBackup(env, master, detail);
  await updateOperation(env, operationId, detail);
  return {
    done: detail.backupComplete,
    operationId,
    copied: detail.copied,
    total,
    backupId: detail.backupId,
    githubPath: detail.githubPath,
    missingObjects: detail.missingObjects || []
  };
}

async function deleteR2Keys(env, keys) {
  for (let offset = 0; offset < keys.length; offset += R2_DELETE_BATCH) {
    await env.ATTACHMENTS.delete(keys.slice(offset, offset + R2_DELETE_BATCH));
  }
}

function masterPlaceholders(masterUids) {
  if (!masterUids.length) httpError(500, '마스터 UID 설정이 없습니다.');
  return masterUids.map(() => '?').join(',');
}

async function resetDatabase(env) {
  const masterUids = configuredMasterUids(env);
  const placeholders = masterPlaceholders(masterUids);
  const time = nowIso();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM audit_logs WHERE action NOT LIKE 'annual_%'"),
    env.DB.prepare('DELETE FROM attachments'),
    env.DB.prepare('DELETE FROM messages'),
    env.DB.prepare('DELETE FROM questions'),
    env.DB.prepare('DELETE FROM teacher_campuses'),
    env.DB.prepare('DELETE FROM student_applications'),
    env.DB.prepare('DELETE FROM teacher_requests'),
    env.DB.prepare(`DELETE FROM users WHERE uid NOT IN (${placeholders})`).bind(...masterUids),
    env.DB.prepare(`
      UPDATE users SET
        role='master',active=1,campus=NULL,student_id=NULL,
        can_answer_questions=1,can_approve_students=1,can_manage_student_info=1,
        updated_at=?
      WHERE uid IN (${placeholders})
    `).bind(time, ...masterUids)
  ]);
}

async function executeReset(request, env, master) {
  const body = await request.json();
  const operationId = cleanText(body.operationId, 80);
  const operation = await getOperation(
    env, operationId, master.identity.uid, 'annual_reset.prepare'
  );
  verifyConfirmation(operation.detail, body);
  const detail = operation.detail;
  if (!detail.backupComplete || !detail.githubPath) {
    httpError(409, 'GitHub 암호화 백업과 R2 사진 보관이 완료되어야 초기화할 수 있습니다.');
  }
  if (detail.completedAt) return { done: true, operationId, completedAt: detail.completedAt };

  const attachmentRows = await env.DB.prepare('SELECT object_key FROM attachments').all();
  await deleteR2Keys(env, (attachmentRows.results || []).map((row) => row.object_key));
  await resetDatabase(env);

  const completedDetail = { ...detail, completedAt: nowIso() };
  await updateOperation(env, operationId, completedDetail);
  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id,actor_uid,action,target_type,target_id,campus,detail_json,created_at
    ) VALUES (?,?,?,?,?,?,?,?)
  `).bind(
    crypto.randomUUID(),
    master.identity.uid,
    'annual_reset.completed',
    'annual_maintenance',
    operationId,
    null,
    JSON.stringify({
      academicYear: detail.academicYear,
      backupId: detail.backupId,
      githubPath: detail.githubPath,
      counts: detail.counts,
      missingObjects: detail.missingObjects || []
    }),
    nowIso()
  ).run();
  return {
    done: true,
    operationId,
    completedAt: completedDetail.completedAt,
    backupId: detail.backupId,
    githubPath: detail.githubPath
  };
}

async function prepareRestore(request, env, master) {
  const body = await request.json();
  const path = cleanText(body.path, 500);
  const envelope = await loadBackupFromGitHub(env, path);
  const snapshot = await decryptSnapshot(env, envelope);
  if (snapshot?.format !== 'etoos247-qa-snapshot') httpError(400, '백업 본문 형식이 올바르지 않습니다.');
  const counts = Object.fromEntries(
    Object.entries(snapshot.tables || {}).map(([table, rows]) => [table, rows.length])
  );
  const detail = {
    type: 'restore',
    path,
    backupId: snapshot.backupId,
    academicYear: snapshot.academicYear,
    counts,
    phrase: operationPhrase('restore', snapshot.backupId),
    code: sixDigitCode(),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString(),
    phase: 'delete_current_r2',
    deleteOffset: 0,
    copyOffset: 0,
    d1ResetDone: false,
    restoreTableIndex: 0,
    restoreRowIndex: 0,
    missingObjects: [],
    completedAt: null
  };
  const operationId = await insertOperation(
    env, master.identity.uid, 'annual_restore.prepare', detail
  );
  return { operationId, ...detail };
}

async function restoreDeleteCurrentR2(env, detail) {
  const result = await env.DB.prepare(`
    SELECT object_key FROM attachments
    ORDER BY created_at,id
    LIMIT ? OFFSET ?
  `).bind(R2_DELETE_BATCH, Number(detail.deleteOffset || 0)).all();
  const rows = result.results || [];
  if (rows.length) await env.ATTACHMENTS.delete(rows.map((row) => row.object_key));
  const next = Number(detail.deleteOffset || 0) + rows.length;
  if (rows.length < R2_DELETE_BATCH) {
    return { ...detail, phase: 'copy_backup_r2', deleteOffset: next };
  }
  return { ...detail, deleteOffset: next };
}

async function restoreCopyR2(env, detail, snapshot) {
  const objects = snapshot.r2?.objects || [];
  const offset = Number(detail.copyOffset || 0);
  const rows = objects.slice(offset, offset + R2_COPY_BATCH);
  const missing = [...(detail.missingObjects || [])];
  for (const row of rows) {
    const object = await env.ATTACHMENTS.get(row.archiveKey);
    if (!object) {
      missing.push(row.archiveKey);
      continue;
    }
    await env.ATTACHMENTS.put(row.sourceKey, object.body, {
      httpMetadata: object.httpMetadata,
      customMetadata: {
        ...(object.customMetadata || {}),
        restoredAt: nowIso(),
        restoredFrom: snapshot.backupId
      }
    });
  }
  const next = offset + rows.length;
  if (next >= objects.length) {
    return { ...detail, phase: 'restore_d1', copyOffset: next, missingObjects: missing };
  }
  return { ...detail, copyOffset: next, missingObjects: missing };
}

function restoreRowsForTable(table, rows, env) {
  return rows.filter((row) => !(table === 'users' && row.role === 'master'));
}

function insertStatement(env, table, row) {
  const columns = TABLE_COLUMNS[table];
  if (!columns) httpError(500, `복원 테이블 정의가 없습니다: ${table}`);
  const placeholders = columns.map(() => '?').join(',');
  const verb = table === 'audit_logs' ? 'INSERT OR IGNORE' : 'INSERT OR REPLACE';
  return env.DB.prepare(
    `${verb} INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`
  ).bind(...columns.map((column) => row[column] ?? null));
}

async function restoreD1Batch(env, detail, snapshot) {
  let nextDetail = { ...detail };
  if (!nextDetail.d1ResetDone) {
    await resetDatabase(env);
    nextDetail.d1ResetDone = true;
    nextDetail.restoreTableIndex = 0;
    nextDetail.restoreRowIndex = 0;
  }

  const statements = [];
  let tableIndex = Number(nextDetail.restoreTableIndex || 0);
  let rowIndex = Number(nextDetail.restoreRowIndex || 0);
  while (tableIndex < TABLE_ORDER.length && statements.length < RESTORE_ROW_BATCH) {
    const table = TABLE_ORDER[tableIndex];
    const rows = restoreRowsForTable(table, snapshot.tables?.[table] || [], env);
    while (rowIndex < rows.length && statements.length < RESTORE_ROW_BATCH) {
      statements.push(insertStatement(env, table, rows[rowIndex]));
      rowIndex += 1;
    }
    if (rowIndex >= rows.length) {
      tableIndex += 1;
      rowIndex = 0;
    }
  }
  if (statements.length) await env.DB.batch(statements);
  nextDetail.restoreTableIndex = tableIndex;
  nextDetail.restoreRowIndex = rowIndex;
  if (tableIndex >= TABLE_ORDER.length) {
    nextDetail.phase = 'completed';
    nextDetail.completedAt = nowIso();
  }
  return nextDetail;
}

async function executeRestore(request, env, master) {
  const body = await request.json();
  const operationId = cleanText(body.operationId, 80);
  const operation = await getOperation(
    env, operationId, master.identity.uid, 'annual_restore.prepare'
  );
  verifyConfirmation(operation.detail, body);
  let detail = operation.detail;
  if (detail.completedAt) return { done: true, operationId, ...detail };

  const envelope = await loadBackupFromGitHub(env, detail.path);
  const snapshot = await decryptSnapshot(env, envelope);
  if (snapshot.backupId !== detail.backupId) httpError(409, '선택한 백업과 확인 기록이 일치하지 않습니다.');

  if (detail.phase === 'delete_current_r2') detail = await restoreDeleteCurrentR2(env, detail);
  else if (detail.phase === 'copy_backup_r2') detail = await restoreCopyR2(env, detail, snapshot);
  else if (detail.phase === 'restore_d1') detail = await restoreD1Batch(env, detail, snapshot);

  await updateOperation(env, operationId, detail);
  if (detail.completedAt) {
    await env.DB.prepare(`
      INSERT INTO audit_logs (
        id,actor_uid,action,target_type,target_id,campus,detail_json,created_at
      ) VALUES (?,?,?,?,?,?,?,?)
    `).bind(
      crypto.randomUUID(),
      master.identity.uid,
      'annual_restore.completed',
      'annual_maintenance',
      operationId,
      null,
      JSON.stringify({
        backupId: detail.backupId,
        path: detail.path,
        missingObjects: detail.missingObjects || []
      }),
      nowIso()
    ).run();
  }
  return {
    done: Boolean(detail.completedAt),
    operationId,
    phase: detail.phase,
    deleteOffset: detail.deleteOffset,
    copyOffset: detail.copyOffset,
    copyTotal: snapshot.r2?.objects?.length || 0,
    restoreTableIndex: detail.restoreTableIndex,
    restoreTableTotal: TABLE_ORDER.length,
    missingObjects: detail.missingObjects || [],
    completedAt: detail.completedAt
  };
}

function parseBackupTimestampFromKey(key) {
  const match = /^backups\/annual\/\d{4}-(\d{13})-[^/]+\//.exec(key);
  return match ? Number(match[1]) : null;
}

export async function cleanupExpiredAnnualArchives(env) {
  const retentionDays = Number(env.BACKUP_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  const cutoff = Date.now() - retentionDays * 86400000;
  let cursor;
  let deleted = 0;
  do {
    const result = await env.ATTACHMENTS.list({
      prefix: 'backups/annual/',
      cursor,
      limit: 1000
    });
    const expiredKeys = result.objects
      .filter((object) => {
        const timestamp = parseBackupTimestampFromKey(object.key);
        return timestamp && timestamp < cutoff;
      })
      .map((object) => object.key);
    await deleteR2Keys(env, expiredKeys);
    deleted += expiredKeys.length;
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);
  return { deleted, retentionDays };
}

export async function handleAnnualMaintenance(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(API_PREFIX)) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  try {
    const master = await requireMaster(request, env);
    if (request.method === 'POST' && url.pathname === `${API_PREFIX}/prepare-reset`) {
      return responseJson(request, env, await prepareReset(request, env, master), 201);
    }
    if (request.method === 'POST' && url.pathname === `${API_PREFIX}/backup-reset`) {
      return responseJson(request, env, await backupReset(request, env, master));
    }
    if (request.method === 'POST' && url.pathname === `${API_PREFIX}/execute-reset`) {
      return responseJson(request, env, await executeReset(request, env, master));
    }
    if (request.method === 'GET' && url.pathname === `${API_PREFIX}/backups`) {
      return responseJson(request, env, { backups: await listGitHubBackups(env) });
    }
    if (request.method === 'POST' && url.pathname === `${API_PREFIX}/prepare-restore`) {
      return responseJson(request, env, await prepareRestore(request, env, master), 201);
    }
    if (request.method === 'POST' && url.pathname === `${API_PREFIX}/execute-restore`) {
      return responseJson(request, env, await executeRestore(request, env, master));
    }
    return responseJson(request, env, { message: '연간 유지관리 API 경로를 찾을 수 없습니다.' }, 404);
  } catch (error) {
    console.error('Annual maintenance error', error);
    return responseJson(request, env, {
      error: Number(error.status) >= 500 ? 'server_error' : 'request_error',
      message: error.message || '연간 유지관리 처리 중 오류가 발생했습니다.'
    }, Number(error.status) || 500);
  }
}
