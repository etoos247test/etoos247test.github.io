import worker from './index.js';
import { verifyFirebaseIdToken } from './firebase-auth.js';
import {
  activateCurrentMasterCompanyLogin,
  changeCompanyPassword,
  createCompanyAccount,
  listCompanyAccounts,
  loginCompanyAccount,
  logoutCompanyAccount,
  resetCompanyPassword,
  setCompanyAccountActive
} from './company-auth.js';
import {
  cleanupExpiredAnnualArchives,
  handleAnnualMaintenance
} from './annual-maintenance-policy.js';
import {
  cleanupExpiredClosedQuestions,
  handleQuestionRetention
} from './question-retention.js';

const BOOTSTRAP_VERSION = 'master-bootstrap-20260809-company-auth';
const COMPANY_AUTH_VERSION = 'company-id-auth-20260809a';

function nowIso() {
  return new Date().toISOString();
}

function companyCorsHeaders(request, env) {
  const requestOrigin = request.headers.get('origin');
  const allowedOrigin = env.ALLOWED_ORIGIN || 'https://etoos247test.github.io';
  return {
    'Access-Control-Allow-Origin': requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function companyJson(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...companyCorsHeaders(request, env),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function configuredMasterUids(env) {
  const combined = [
    String(env.MASTER_FIREBASE_UIDS || ''),
    String(env.MASTER_FIREBASE_UID || '')
  ].join(',');

  return new Set(
    combined
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

async function ensureBootstrapMaster(request, env) {
  const masterUids = configuredMasterUids(env);
  if (!masterUids.size) return;

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return;

  const identity = await verifyFirebaseIdToken(request, env);
  if (!masterUids.has(identity.uid)) return;

  const time = nowIso();
  const email = String(identity.email || '').trim();
  const name = String(identity.name || '마스터').trim() || '마스터';

  await env.DB.prepare(`
    INSERT INTO users (
      uid,email,name,role,active,campus,student_id,
      can_answer_questions,can_approve_students,can_manage_student_info,
      created_at,updated_at
    )
    VALUES (?,?,?,'master',1,NULL,NULL,1,1,1,?,?)
    ON CONFLICT(uid) DO UPDATE SET
      email=excluded.email,
      name=CASE
        WHEN users.name IS NULL OR TRIM(users.name)='' THEN excluded.name
        ELSE users.name
      END,
      role='master',
      active=1,
      campus=NULL,
      student_id=NULL,
      can_answer_questions=1,
      can_approve_students=1,
      can_manage_student_info=1,
      updated_at=excluded.updated_at
  `).bind(identity.uid, email, name, time, time).run();
}

async function handleCompanyAuth(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/company-auth/')) return null;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: companyCorsHeaders(request, env) });
  }

  try {
    if (url.pathname === '/api/company-auth/login' && request.method === 'POST') {
      return companyJson(request, env, await loginCompanyAccount(request, env));
    }

    const identity = await verifyFirebaseIdToken(request, env);

    if (url.pathname === '/api/company-auth/logout' && request.method === 'POST') {
      return companyJson(request, env, await logoutCompanyAccount(request, env, identity));
    }
    if (url.pathname === '/api/company-auth/change-password' && request.method === 'POST') {
      return companyJson(request, env, await changeCompanyPassword(request, env, identity));
    }
    if (url.pathname === '/api/company-auth/activate-current-master' && request.method === 'POST') {
      return companyJson(request, env, await activateCurrentMasterCompanyLogin(request, env, identity), 201);
    }
    if (url.pathname === '/api/company-auth/accounts' && request.method === 'GET') {
      return companyJson(request, env, await listCompanyAccounts(env, identity));
    }
    if (url.pathname === '/api/company-auth/accounts' && request.method === 'POST') {
      return companyJson(request, env, await createCompanyAccount(request, env, identity), 201);
    }

    let match = /^\/api\/company-auth\/accounts\/([^/]+)\/reset-password$/.exec(url.pathname);
    if (match && request.method === 'POST') {
      return companyJson(request, env, await resetCompanyPassword(request, env, identity, match[1]));
    }
    match = /^\/api\/company-auth\/accounts\/([^/]+)\/active$/.exec(url.pathname);
    if (match && request.method === 'POST') {
      return companyJson(request, env, await setCompanyAccountActive(request, env, identity, match[1]));
    }

    return companyJson(request, env, { message: '회사 인증 API 경로를 찾을 수 없습니다.' }, 404);
  } catch (error) {
    console.error('Company auth failed', error);
    return companyJson(request, env, {
      error: Number(error.status) >= 500 ? 'server_error' : 'request_error',
      message: Number(error.status) >= 500 ? '회사 로그인 처리 중 오류가 발생했습니다.' : error.message
    }, Number(error.status) || 500);
  }
}

async function withHealthVersion(request, env, ctx) {
  const response = await worker.fetch(request, env, ctx);
  const data = await response.clone().json().catch(() => null);
  if (!data || typeof data !== 'object') return response;

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify({
    ...data,
    masterBootstrapVersion: BOOTSTRAP_VERSION,
    companyAuthVersion: COMPANY_AUTH_VERSION,
    companyAuthMode: 'parallel-with-firebase',
    annualMaintenanceVersion: 'annual-maintenance-20260807b',
    questionRetentionVersion: 'question-retention-20260807b',
    closedQuestionRetentionDays: Number(env.QUESTION_CLOSED_RETENTION_DAYS || 7),
    questionCleanupBatchSize: 100,
    questionCleanupTotalLimit: null,
    backupPhotoRetentionDays: Number(env.BACKUP_RETENTION_DAYS || 30)
  }), {
    status: response.status,
    headers
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return withHealthVersion(request, env, ctx);
    }

    const companyResponse = await handleCompanyAuth(request, env);
    if (companyResponse) return companyResponse;

    try {
      await ensureBootstrapMaster(request, env);
    } catch (error) {
      console.error('Master bootstrap failed', error);
    }

    const retentionResponse = await handleQuestionRetention(request, env);
    if (retentionResponse) return retentionResponse;

    const maintenanceResponse = await handleAnnualMaintenance(request, env);
    if (maintenanceResponse) return maintenanceResponse;

    return worker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(Promise.allSettled([
      cleanupExpiredAnnualArchives(env).catch((error) => {
        console.error('Annual archive cleanup failed', error);
        throw error;
      }),
      cleanupExpiredClosedQuestions(env).catch((error) => {
        console.error('Closed question cleanup failed', error);
        throw error;
      })
    ]));
  }
};
