# etoostest2 — Firebase 없는 회사 ID 시험본

기존 `etoos247test`는 그대로 보존하고, 인증만 회사 발급 ID/비밀번호 방식으로 바꾼 병행 시험본입니다.

- 원본 Firebase 스냅샷 브랜치: `firebase-preserved-20260809`
- 화면: `/etoostest2/`
- 기존 질문 UI/업무 로직 재사용
- v2 Worker: `cloudflare/qa-worker-v2/`
- 기존 D1 공유, 모든 데이터 테이블은 `v2_` 접두어로 분리
- 기존 R2 공유, 사진은 `qa-v2/v1/` 경로로 분리
- 비밀번호: PBKDF2-HMAC-SHA256 600,000회 + 개별 salt
- 로그인 실패 5회 시 10분 잠금
- 회사가 학생·교사·관리자 ID와 임시 비밀번호 직접 발급

## Cloudflare 적용 순서

```bash
cd cloudflare/qa-worker-v2
npx wrangler d1 execute etoos247-qa --remote --file=migrations/1001_v2_initial.sql
npx wrangler secret put SESSION_SECRET
npx wrangler secret put BOOTSTRAP_SECRET
npx wrangler deploy
```

최초 마스터 생성은 `POST /api/v2/bootstrap-master`에 `X-Bootstrap-Secret` 헤더를 붙여 1회 실행합니다. `SESSION_SECRET`과 `BOOTSTRAP_SECRET`은 저장소에 커밋하지 않습니다.
