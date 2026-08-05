# 이투스247 질문 시스템 Cloudflare 전환 시험

이 폴더는 Firebase Authentication만 로그인에 사용하고, 질문·답변·권한은 Cloudflare D1, 사진은 Cloudflare R2에 저장하는 시험용 Worker 프로젝트다.

현재 공개 운영 화면과 Firestore 데이터는 변경하지 않는다. `cloudflare-qa-pilot-20260805` 브랜치에서 별도로 검증한 뒤 전환한다.

## 고정 운영 원칙

- Firebase: Google 로그인과 ID 토큰 발급만 담당
- GitHub Pages: 학생·교사·관리자 화면 배포
- Cloudflare Worker: Firebase 토큰 검증, 관별 권한 검사, API 처리
- Cloudflare D1: 사용자, 가입 승인, 질문방, 메시지, 첨부 메타정보, 감사기록
- Cloudflare R2: 학생 문제사진과 교사 풀이사진 원본
- 사진은 한 장당 서버 기준 1MB 이하
- JPG, PNG, WebP만 허용
- 한 메시지당 최대 3장
- R2 버킷은 비공개로 유지하고 Worker를 통해서만 열람

## D1 테이블

초기 스키마는 `migrations/0001_initial.sql`에 고정한다.

- `users`: 학생·교사·마스터 역할과 권한
- `teacher_campuses`: 교사가 열람할 수 있는 관
- `student_applications`: 학생 가입 요청과 승인 결과
- `teacher_requests`: 교사 권한 요청
- `questions`: 질문방의 현재 상태
- `messages`: 학생 질문, 교사 피드백, 학생 재질문, 교사 재피드백
- `attachments`: R2 사진과 D1 메시지의 연결정보
- `audit_logs`: 주요 관리 작업 기록

질문 상태는 다음 세 값만 사용한다.

- `waiting_teacher`: 학생이 마지막 메시지를 보냈으며 교사 답변 대기
- `waiting_student`: 교사 또는 마스터가 마지막 메시지를 보냈으며 학생 확인 대기
- `closed`: 질문 종료

## R2 파일 경로 규칙

모든 운영 사진은 아래 규칙을 사용한다.

```text
qa/v1/{campus}/{YYYY}/{MM}/{questionId}/{messageId}/{attachmentId}.{ext}
```

예시:

```text
qa/v1/suseong1/2026/08/5ea.../b31.../98d....webp
```

경로에는 학생 이름, 이메일, 학생번호를 넣지 않는다. 경로는 업로드 이후 변경하지 않는다. D1 `attachments.object_key`가 R2 원본의 영구 연결키다.

이 규칙을 지키면 NAS 백업을 추가할 때 R2의 `qa/v1/` 전체를 그대로 증분 복사하고, D1 SQL 내보내기 파일만 함께 보관하면 된다. 프로그램의 질문·답변 구조를 다시 수정할 필요가 없다.

## 로컬 설치

```bash
cd cloudflare/qa-worker
npm install
cp wrangler.jsonc.example wrangler.jsonc
```

## Cloudflare 자원 생성

```bash
npx wrangler login
npx wrangler d1 create etoos247-qa
npx wrangler r2 bucket create etoos247-qa-attachments
```

D1 생성 결과의 `database_id`를 `wrangler.jsonc`에 입력한다. R2 버킷 이름은 `etoos247-qa-attachments`로 유지한다.

## D1 초기화

먼저 로컬 스키마를 적용한다.

```bash
npm run db:local
```

원격 D1을 만든 뒤 실제 스키마를 적용한다.

```bash
npm run db:remote
```

## 실행과 배포

```bash
npm run dev
npm run deploy
```

배포 후 `/health`에서 다음 값이 나오면 Worker 기본 연결이 정상이다.

```json
{
  "ok": true,
  "service": "etoos247-qa-api",
  "storagePathVersion": "qa/v1"
}
```

## 현재 구현된 시험 API

- `GET /health`
- `GET /api/me`
- `POST /api/student-applications`
- `GET /api/questions`
- `POST /api/questions`
- `GET /api/questions/{questionId}/messages`
- `POST /api/questions/{questionId}/messages`
- `POST /api/questions/{questionId}/close`
- `GET /api/attachments/{attachmentId}`

보호 API는 아래 헤더로 Firebase ID 토큰을 받는다.

```text
Authorization: Bearer {Firebase ID token}
```

## 다음 구현 순서

1. Cloudflare 계정에서 D1과 R2 생성
2. Worker 배포 및 `/health` 확인
3. D1에 시험용 마스터 사용자 입력
4. GitHub Pages 기존 화면에 Cloudflare API 클라이언트 추가
5. 학생 가입 요청과 승인 기능을 D1로 연결
6. 학생 질문·교사 답변·재질문·재피드백 연결
7. 브라우저 사진 압축과 1MB 서버 검증 통합시험
8. 관별 접근 차단시험
9. 기존 Firestore 데이터를 유지한 상태에서 병행시험
10. 안정화 뒤 Firestore 운영 데이터 전환 여부 결정

## NAS 백업 추가 시 변경하지 않는 항목

- D1 테이블명과 기본키
- 질문·메시지·첨부파일 UUID
- `attachments.object_key`
- R2 `qa/v1/` 경로 규칙
- UTC ISO 8601 날짜 저장

나중에 추가하는 것은 백업 작업뿐이다.

- D1 원격 데이터베이스를 날짜별 SQL로 내보내기
- R2 `qa/v1/`를 NAS로 `copy` 방식 증분 복사
- 백업 로그와 복원시험 절차 추가
