import { decodeProtectedHeader, importX509, jwtVerify } from 'jose';
import { isCompanyBearer, verifyCompanySession } from './company-auth.js';

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache = { expiresAt: 0, certs: null };

function cacheMaxAge(headerValue) {
  const match = /(?:^|,)\s*max-age=(\d+)/i.exec(headerValue || '');
  return match ? Number(match[1]) : 300;
}

async function getCertificates() {
  const now = Date.now();
  if (certCache.certs && certCache.expiresAt > now + 10_000) return certCache.certs;

  const response = await fetch(CERT_URL);
  if (!response.ok) throw new Error(`Firebase 공개키 조회 실패: ${response.status}`);
  const certs = await response.json();
  const maxAge = cacheMaxAge(response.headers.get('cache-control'));
  certCache = { certs, expiresAt: now + maxAge * 1000 };
  return certs;
}

export async function verifyFirebaseIdToken(request, env) {
  if (isCompanyBearer(request)) return verifyCompanySession(request, env);

  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw Object.assign(new Error('로그인 토큰이 필요합니다.'), { status: 401 });

  const token = match[1];
  const protectedHeader = decodeProtectedHeader(token);
  if (protectedHeader.alg !== 'RS256' || !protectedHeader.kid) {
    throw Object.assign(new Error('유효하지 않은 Firebase 토큰 헤더입니다.'), { status: 401 });
  }

  const certs = await getCertificates();
  const cert = certs[protectedHeader.kid];
  if (!cert) {
    certCache.expiresAt = 0;
    throw Object.assign(new Error('Firebase 공개키와 일치하지 않는 토큰입니다.'), { status: 401 });
  }

  const key = await importX509(cert, 'RS256');
  const issuer = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`;
  const { payload } = await jwtVerify(token, key, {
    algorithms: ['RS256'],
    audience: env.FIREBASE_PROJECT_ID,
    issuer
  });

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw Object.assign(new Error('Firebase UID가 없는 토큰입니다.'), { status: 401 });
  }
  if (typeof payload.auth_time !== 'number' || payload.auth_time > Math.floor(Date.now() / 1000)) {
    throw Object.assign(new Error('Firebase 인증 시간이 올바르지 않습니다.'), { status: 401 });
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : '',
    name: typeof payload.name === 'string' ? payload.name : '',
    picture: typeof payload.picture === 'string' ? payload.picture : ''
  };
}
