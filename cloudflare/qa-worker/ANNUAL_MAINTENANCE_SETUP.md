# 이투스247 질문 시스템 연간 백업·초기화 설정

## 구현 범위

- 마스터 전용 1단계 삭제 대상 확인
- 확인 문구와 6자리 번호를 이용한 2단계 확인
- 초기화 전에 D1 전체 자료를 gzip 압축 후 AES-256-GCM으로 암호화
- 암호화된 백업만 GitHub `backups/qa/{학년도}/`에 저장
- 첨부 사진을 비공개 R2 `backups/annual/{backupId}/r2/`로 복사
- 백업 완료 전 초기화 실행 차단
- GitHub 백업 목록 확인과 D1·R2 복원
- R2 보관 사진은 기본 90일 후 매일 자동 정리
- 마스터 계정은 초기화 대상에서 제외

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
BACKUP_RETENTION_DAYS=90
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
  "annualMaintenanceVersion": "annual-maintenance-20260807a"
}
```

## 운영 절차

1. 마스터 계정으로 `/question-access/` 로그인
2. `학년도 백업·초기화`에서 새 학년도 입력
3. `1단계 삭제 대상 확인`
4. 표시된 확인 문구와 6자리 번호를 다시 입력
5. `2단계 암호화 백업 실행`
6. GitHub 경로와 R2 사진 건수 확인
7. `백업 확인 후 초기화`
8. 필요 시 `GitHub 백업 목록 불러오기`에서 백업을 선택해 복원

## 개인정보 처리 원칙

GitHub에는 학생 이름·이메일·연락처·질문 내용이 평문으로 저장되지 않는다. D1 백업 전체를 gzip으로 압축한 뒤 AES-256-GCM으로 암호화한 파일만 저장한다. 사진 원본은 GitHub에 저장하지 않고 비공개 R2 보관영역에만 복사한다.
