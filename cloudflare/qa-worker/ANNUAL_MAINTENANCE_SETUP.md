# 이투스247 질문 시스템 연간 백업·초기화 설정

## 구현 범위

- 마스터 전용 1단계 삭제 대상 확인
- 확인 문구와 6자리 번호를 이용한 2단계 확인
- 초기화 전에 D1 전체 자료를 gzip 압축 후 AES-256-GCM으로 암호화
- 암호화된 백업만 GitHub `backups/qa/{학년도}/`에 저장
- 첨부 사진을 비공개 R2 `backups/annual/{backupId}/r2/`로 복사
- 백업 완료 전 초기화 실행 차단
- GitHub 백업 목록 확인과 D1·R2 복원
- 연간 백업 사진 사본은 30일 후 매일 자동 정리
- 종료 질문은 종료 시각부터 7일 후 질문·답변·첨부사진 자동 삭제
- 마스터는 질문을 수시로 즉시 삭제 가능
- 마스터 계정과 현재 승인 교사의 인증·소속관·권한은 학년도 초기화에서 유지

## 반드시 설정할 Worker 비밀값

공개 저장소나 `wrangler.jsonc`에 토큰과 암호화 키를 적지 않는다.

### 1. GitHub 백업 토큰

GitHub에서 `etoos247test/etoos247test.github.io` 저장소만 접근 가능한 fine-grained personal access token을 만든다.

필수 저장소 권한:

- Contents: Read and write
- Metadata: Read

Cloudflare Worker 설정에서 다음 비밀값으로 등록한다.

```text
GITHUB_BACKUP_TOKEN
```

Wrangler CLI를 사용할 때:

```bash
cd cloudflare/qa-worker
npx wrangler secret put GITHUB_BACKUP_TOKEN
```

### 2. 백업 암호화 키

32바이트 무작위 키를 Base64로 만든다.

```bash
openssl rand -base64 32
```

생성된 값을 안전한 별도 보관 장소에도 저장한 뒤 Worker 비밀값으로 등록한다.

```text
BACKUP_ENCRYPTION_KEY
```

Wrangler CLI를 사용할 때:

```bash
cd cloudflare/qa-worker
npx wrangler secret put BACKUP_ENCRYPTION_KEY
```

이 키를 잃으면 기존 GitHub 암호화 백업을 복원할 수 없다.

## 공개 환경변수

`wrangler.jsonc`에 다음 값이 설정돼 있다.

```text
GITHUB_BACKUP_REPO=etoos247test/etoos247test.github.io
GITHUB_BACKUP_BRANCH=main
BACKUP_RETENTION_DAYS=30
QUESTION_CLOSED_RETENTION_DAYS=7
```

## 배포 확인

비밀값을 등록한 뒤 Worker를 다시 배포한다.

```bash
cd cloudflare/qa-worker
npm run deploy
```

상태 확인:

```text
https://etoos247-qa-api.etoos247test.workers.dev/health
```

응답에 다음 항목이 있어야 한다.

```json
{
  "annualMaintenanceVersion": "annual-maintenance-20260807b",
  "questionRetentionVersion": "question-retention-20260807a",
  "closedQuestionRetentionDays": 7,
  "backupPhotoRetentionDays": 30
}
```

## 학년도 초기화 운영 절차

1. 마스터 계정으로 `/question-access/` 로그인
2. `학년도 백업·초기화`에서 새 학년도 입력
3. `1단계 삭제 대상 확인`
4. 현재 승인 교사가 초기화 제외 대상으로 표시되는지 확인
5. 표시된 확인 문구와 6자리 번호를 다시 입력
6. `2단계 암호화 백업 실행`
7. GitHub 경로와 R2 사진 건수 확인
8. `백업 확인 후 초기화`
9. 초기화 후 마스터와 현재 승인 교사 계정·소속관·권한 확인

## 백업 복원 절차

1. 마스터 계정으로 `/question-access/` 로그인
2. `백업 목록·복원`에서 `GitHub 백업 목록 불러오기` 선택
3. 복원할 백업 선택
4. `1단계 복원 내용 확인`
5. 확인 문구와 6자리 번호 입력
6. `2단계 백업 복원 실행`
7. R2 사진과 D1 자료 복원 진행률 확인
8. 완료 후 현재 승인 교사의 인증정보와 권한이 유지됐는지 확인

연간 R2 사진 사본은 백업 후 30일 동안만 보관된다. 30일이 지난 백업은 GitHub의 암호화 D1 글 자료를 복원할 수 있어도 사진 사본은 복원되지 않을 수 있다.

## 질문 삭제 정책

- 질문을 교사 또는 마스터가 `종료`하면 `closed_at`이 기록된다.
- 매일 예약 작업이 종료 후 7일이 지난 질문을 자동 삭제한다.
- 질문 삭제 시 질문, 대화, 첨부 메타정보와 R2 사진 원본을 함께 삭제한다.
- 마스터는 `질문 자동삭제·수시 삭제` 화면에서 7일 전에도 즉시 삭제할 수 있다.

## 개인정보 처리 원칙

GitHub에는 학생 이름·이메일·연락처·질문 내용이 평문으로 저장되지 않는다. D1 백업 전체를 gzip으로 압축한 뒤 AES-256-GCM으로 암호화한 파일만 저장한다. 사진 원본은 GitHub에 저장하지 않고 비공개 R2 보관영역에만 복사한다.
