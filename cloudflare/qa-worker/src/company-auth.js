const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_LOCK_MS = 10 * 60 * 1000;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeLoginId(value) {
  return String(value || '').trim().toUpperCase().slice(0, 64);
}

function bytesToHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value) {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return `cid_${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
}

async function sha256Text(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function derivePassword(password, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations
  }, key, 256);
  return new Uint8Array(bits);
}

async function hashPassword(password) {
  const text = String(password || '');
  if (text.length < 5) fail(400, '비밀번호는 5자 이상이어야 합니다.');
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derivePassword(text, salt);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const actual = await derivePassword(password, hexToBytes(parts[2]), Number(parts[1]));
  const expected = hexToBytes(parts[3]);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < actual.length; index += 1) diff |= actual[index] ^ expected[index];
  return diff === 0;
}

async function profileForUid(env, uid) {
  return env.DB.prepare('SELECT * FROM users WHERE uid=?').bind(uid).first();
}

async function requireMaster(env, identity) {
  const profile = await profileForUid(env, identity.uid);
  if (!profile || profile.active !== 1 || profile.role !== 'master') {
    fail(403, '마스터 권한이 필요합니다.');
  }
  return profile;
}

async function createSession(env, uid) {
  const token = randomToken();
  const tokenHash = await sha256Text(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await env.DB.prepare(`
    INSERT INTO company_sessions (token_hash,uid,expires_at,created_at,last_seen_at)
    VALUES (?,?,?,?,?)
  `).bind(tokenHash, uid, expiresAt, createdAt, createdAt).run();
  return token;
}

export function isCompanyBearer(request) {
  const header = request.headers.get('authorization') || '';
  return /^Bearer\s+cid_/i.test(header);
}

export async function verifyCompanySession(request, env) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(cid_[A-Za-z0-9_-]+)$/i.exec(header);
  if (!match) fail(401, '회사 로그인 세션이 필요합니다.');
  const tokenHash = await sha256Text(match[1]);
  const row = await env.DB.prepare(`
    SELECT s.uid,s.expires_at,a.account_status,u.email,u.name,u.active
    FROM company_sessions s
    JOIN company_accounts a ON a.uid=s.uid
    JOIN users u ON u.uid=s.uid
    WHERE s.token_hash=?
  `).bind(tokenHash).first();
  if (!row || row.account_status !== 'active' || row.active !== 1) {
    fail(401, '유효하지 않은 회사 로그인 세션입니다.');
  }
  if (row.expires_at <= nowIso()) {
    await env.DB.prepare('DELETE FROM company_sessions WHERE token_hash=?').bind(tokenHash).run();
    fail(401, '회사 로그인 세션이 만료되었습니다.');
  }
  await env.DB.prepare('UPDATE company_sessions SET last_seen_at=? WHERE token_hash=?')
    .bind(nowIso(), tokenHash).run();
  return { uid: row.uid, email: row.email || '', name: row.name || '', picture: '' };
}

export async function loginCompanyAccount(request, env) {
  const body = await request.json().catch(() => ({}));
  const loginId = normalizeLoginId(body.loginId);
  const password = String(body.password || '');
  const row = await env.DB.prepare(`
    SELECT a.*,u.email,u.name,u.role,u.active,u.campus,u.student_id
    FROM company_accounts a
    JOIN users u ON u.uid=a.uid
    WHERE a.login_id=?
  `).bind(loginId).first();
  if (!row) fail(401, 'ID 또는 비밀번호가 맞지 않습니다.');
  if (row.active !== 1 || row.account_status !== 'active') fail(403, '현재 이용이 중지된 계정입니다.');
  if (row.locked_until && row.locked_until > nowIso()) fail(429, '로그인 실패가 반복되어 10분간 잠겨 있습니다.');

  if (!(await verifyPassword(password, row.password_hash))) {
    const failedCount = Number(row.failed_count || 0) + 1;
    const lockedUntil = failedCount >= 5 ? new Date(Date.now() + LOGIN_LOCK_MS).toISOString() : null;
    await env.DB.prepare(`
      UPDATE company_accounts
      SET failed_count=?,locked_until=?,updated_at=?
      WHERE uid=?
    `).bind(failedCount >= 5 ? 0 : failedCount, lockedUntil, nowIso(), row.uid).run();
    fail(401, 'ID 또는 비밀번호가 맞지 않습니다.');
  }

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE company_accounts
      SET failed_count=0,locked_until=NULL,last_login_at=?,updated_at=?
      WHERE uid=?
    `).bind(nowIso(), nowIso(), row.uid),
    env.DB.prepare('DELETE FROM company_sessions WHERE expires_at<=?').bind(nowIso())
  ]);
  const sessionToken = await createSession(env, row.uid);
  return {
    sessionToken,
    mustChangePassword: row.must_change_password === 1,
    identity: { uid: row.uid, email: row.email || '', name: row.name || '' },
    profile: {
      uid: row.uid,
      name: row.name,
      role: row.role,
      active: row.active,
      campus: row.campus,
      student_id: row.student_id
    }
  };
}

export async function logoutCompanyAccount(request, env, identity) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(cid_[A-Za-z0-9_-]+)$/i.exec(header);
  if (match) {
    const tokenHash = await sha256Text(match[1]);
    await env.DB.prepare('DELETE FROM company_sessions WHERE token_hash=? AND uid=?')
      .bind(tokenHash, identity.uid).run();
  }
  return { ok: true };
}

export async function changeCompanyPassword(request, env, identity) {
  const body = await request.json().catch(() => ({}));
  const account = await env.DB.prepare('SELECT * FROM company_accounts WHERE uid=?')
    .bind(identity.uid).first();
  if (!account) fail(404, '회사 로그인 계정을 찾을 수 없습니다.');
  if (!(await verifyPassword(body.currentPassword, account.password_hash))) {
    fail(401, '현재 비밀번호가 맞지 않습니다.');
  }
  const passwordHash = await hashPassword(body.newPassword);
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE company_accounts
      SET password_hash=?,must_change_password=0,failed_count=0,locked_until=NULL,updated_at=?
      WHERE uid=?
    `).bind(passwordHash, nowIso(), identity.uid),
    env.DB.prepare('DELETE FROM company_sessions WHERE uid=?').bind(identity.uid)
  ]);
  return { ok: true, sessionToken: await createSession(env, identity.uid) };
}

export async function activateCurrentMasterCompanyLogin(request, env, identity) {
  await requireMaster(env, identity);
  const body = await request.json().catch(() => ({}));
  const loginId = normalizeLoginId(body.loginId);
  if (!/^[A-Z0-9._-]{3,64}$/.test(loginId)) fail(400, '회사 ID 형식을 확인하세요.');
  const passwordHash = await hashPassword(body.temporaryPassword);
  const time = nowIso();
  await env.DB.prepare(`
    INSERT INTO company_accounts
      (uid,login_id,password_hash,must_change_password,failed_count,account_status,created_at,updated_at)
    VALUES (?,?,?,1,0,'active',?,?)
    ON CONFLICT(uid) DO UPDATE SET
      login_id=excluded.login_id,
      password_hash=excluded.password_hash,
      must_change_password=1,
      failed_count=0,
      locked_until=NULL,
      account_status='active',
      updated_at=excluded.updated_at
  `).bind(identity.uid, loginId, passwordHash, time, time).run();
  await env.DB.prepare('DELETE FROM company_sessions WHERE uid=?').bind(identity.uid).run();
  return { ok: true, uid: identity.uid, loginId };
}

export async function listCompanyAccounts(env, identity) {
  await requireMaster(env, identity);
  const rows = await env.DB.prepare(`
    SELECT u.uid,u.name,u.role,u.active,u.campus,u.student_id,
           a.login_id,a.must_change_password,a.last_login_at,a.account_status
    FROM users u
    JOIN company_accounts a ON a.uid=u.uid
    ORDER BY CASE u.role WHEN 'master' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END,u.name
  `).all();
  return { accounts: rows.results };
}

export async function createCompanyAccount(request, env, identity) {
  await requireMaster(env, identity);
  const body = await request.json().catch(() => ({}));
  const loginId = normalizeLoginId(body.loginId);
  const name = String(body.name || '').trim();
  const role = String(body.role || '');
  if (!/^[A-Z0-9._-]{3,64}$/.test(loginId) || name.length < 2 || !['student','teacher','master'].includes(role)) {
    fail(400, '계정 정보를 확인하세요.');
  }
  const passwordHash = await hashPassword(body.temporaryPassword);
  const time = nowIso();
  let uid = String(body.existingUid || '').trim();
  let existing = uid ? await profileForUid(env, uid) : null;
  if (!existing && role === 'student' && body.studentId) {
    existing = await env.DB.prepare("SELECT * FROM users WHERE role='student' AND student_id=?")
      .bind(normalizeLoginId(body.studentId)).first();
    if (existing) uid = existing.uid;
  }

  const statements = [];
  if (!existing) {
    uid = crypto.randomUUID();
    let campus = null;
    let studentId = null;
    if (role === 'student') {
      campus = String(body.campus || '');
      if (!['suseong1','suseong2'].includes(campus)) fail(400, '소속관을 선택하세요.');
      studentId = normalizeLoginId(body.studentId || loginId);
      const prefix = campus === 'suseong1' ? 'M' : 'S';
      if (!new RegExp(`^${prefix}\\d{3}$`).test(studentId)) fail(400, '학생번호는 M001 또는 S001 형식이어야 합니다.');
    }
    const canAnswer = role === 'master' ? 1 : role === 'teacher' && body.canAnswerQuestions ? 1 : 0;
    const canApprove = role === 'master' ? 1 : role === 'teacher' && body.canApproveStudents ? 1 : 0;
    const canManage = role === 'master' ? 1 : role === 'teacher' && body.canManageStudentInfo ? 1 : 0;
    statements.push(env.DB.prepare(`
      INSERT INTO users (
        uid,email,name,role,active,campus,student_id,
        can_answer_questions,can_approve_students,can_manage_student_info,created_at,updated_at
      ) VALUES (?,?,?,?,1,?,?,?,?,?,?,?)
    `).bind(
      uid, `${loginId}@etoos247.local`, name, role, campus, studentId,
      canAnswer, canApprove, canManage, time, time
    ));
    if (role === 'teacher') {
      for (const campusName of (body.campuses || []).filter((value) => ['suseong1','suseong2'].includes(value))) {
        statements.push(env.DB.prepare('INSERT INTO teacher_campuses (teacher_uid,campus,created_at) VALUES (?,?,?)')
          .bind(uid, campusName, time));
      }
    }
  }
  statements.push(env.DB.prepare(`
    INSERT INTO company_accounts
      (uid,login_id,password_hash,must_change_password,failed_count,account_status,created_at,updated_at)
    VALUES (?,?,?,1,0,'active',?,?)
  `).bind(uid, loginId, passwordHash, time, time));
  await env.DB.batch(statements);
  return { uid, loginId, name: existing?.name || name, role: existing?.role || role };
}

export async function resetCompanyPassword(request, env, identity, uid) {
  await requireMaster(env, identity);
  const body = await request.json().catch(() => ({}));
  const passwordHash = await hashPassword(body.temporaryPassword);
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE company_accounts
      SET password_hash=?,must_change_password=1,failed_count=0,locked_until=NULL,updated_at=?
      WHERE uid=?
    `).bind(passwordHash, nowIso(), uid),
    env.DB.prepare('DELETE FROM company_sessions WHERE uid=?').bind(uid)
  ]);
  return { ok: true };
}

export async function setCompanyAccountActive(request, env, identity, uid) {
  const master = await requireMaster(env, identity);
  const body = await request.json().catch(() => ({}));
  const active = body.active ? 1 : 0;
  if (uid === master.uid && active === 0) fail(400, '현재 마스터 계정은 중지할 수 없습니다.');
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET active=?,updated_at=? WHERE uid=?').bind(active, nowIso(), uid),
    env.DB.prepare('UPDATE company_accounts SET account_status=?,updated_at=? WHERE uid=?')
      .bind(active ? 'active' : 'disabled', nowIso(), uid),
    env.DB.prepare('DELETE FROM company_sessions WHERE uid=?').bind(uid)
  ]);
  return { ok: true, active };
}
