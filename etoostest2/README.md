# etoostest2 — Firebase 없는 회사 ID 시험본

기존 `etoos247test`는 그대로 보존하고, 시작 인증만 회사 발급 ID/비밀번호 방식으로 바꾼 병행 시험본입니다.

- 원본 Firebase 스냅샷 브랜치: `firebase-preserved-20260809`
- 시험버전 1: `/etoostest1/` — Firebase 유지 + 새 입구
- 시험버전 2: `/etoostest2/` — 회사 ID + 새 입구
- 회사 ID 업무화면: `/etoostest2/workspace.html`
- 기존 Worker 그대로 사용: `etoos247-qa-api`
- 기존 D1 `users`, `questions`, `messages`, `attachments` 그대로 사용
- 기존 R2 사진 경로 그대로 사용
- 회사 로그인용 테이블만 추가: `company_accounts`, `company_sessions`
- 비밀번호: PBKDF2-HMAC-SHA256 100,000회 + 개별 salt (Cloudflare Workers Web Crypto 제한 반영)
- 로그인 실패 5회 시 10분 잠금
- 세션 유효시간 12시간

## 기존 Worker에 적용할 변경

```bash
cd cloudflare/qa-worker
npx wrangler d1 migrations apply etoos247-qa --remote
npx wrangler deploy
```

별도 Worker나 별도 D1은 만들지 않습니다.

## 최초 회사 관리자 ID 연결

1. `/etoostest1/setup-company-id.html`에서 기존 Firebase 마스터로 로그인
2. 회사 ID와 임시 비밀번호 입력
3. 기존 마스터 UID에 `company_accounts` 로그인 자격 연결
4. `/etoostest2/`에서 회사 ID로 로그인
5. 관리자 화면에서 학생·교사 회사 ID를 직접 발급

학생번호가 이미 존재하면 새 회사 ID를 같은 학생 레코드에 연결할 수 있도록 구성했습니다.
