import worker from './index.js';
import { verifyFirebaseIdToken } from './firebase-auth.js';
import {
  cleanupExpiredAnnualArchives,
  handleAnnualMaintenance
} from './annual-maintenance.js';

const BOOTSTRAP_VERSION = 'master-bootstrap-20260807c';

function nowIso() {
  return new Date().toISOString();
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
    annualMaintenanceVersion: 'annual-maintenance-20260807a'
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

    try {
      await ensureBootstrapMaster(request, env);
    } catch (error) {
      console.error('Master bootstrap failed', error);
    }

    const maintenanceResponse = await handleAnnualMaintenance(request, env);
    if (maintenanceResponse) return maintenanceResponse;

    return worker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      cleanupExpiredAnnualArchives(env).catch((error) => {
        console.error('Annual archive cleanup failed', error);
      })
    );
  }
};
