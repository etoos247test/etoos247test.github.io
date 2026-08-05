# 학생 로그인 계정 규칙 — 수성1관·수성2관

## 로그인 입력

학생은 다음 세 값을 입력한다.

1. 소속관: 수성1관 또는 수성2관
2. 학생번호: M001~M100
3. 비밀번호: 발급받은 초기 비밀번호 또는 변경 비밀번호

## 내부 Firebase Authentication 이메일

학생 화면에는 이메일을 노출하지 않는다. 프로그램이 소속관과 학생번호를 조합해 내부 로그인 이메일을 만든다.

| 소속관 | 학생번호 | 내부 이메일 |
|---|---|---|
| 수성1관 | M001 | s1-m001@etoos247test.local |
| 수성2관 | M001 | s2-m001@etoos247test.local |

따라서 `M001`은 수성1관과 수성2관에서 각각 한 번씩 사용할 수 있다.

## 중복 판단

중복 기준은 학생번호 단독이 아니라 다음 조합이다.

```text
campus + studentId
```

허용:

```text
수성1관 M001
수성2관 M001
```

차단:

```text
수성1관 M001
수성1관 M001
```

## 계정 생성 권한

학생 계정은 다음 사용자만 생성할 수 있다.

- 활성 마스터
- `canApproveStudents: true`인 활성 교사
- 해당 교사의 `allowedCampuses`에 생성 대상 소속관이 포함된 경우

예를 들어 수성1관만 승인받은 준마스터는 수성1관 학생 계정만 생성할 수 있다.

## 생성 데이터

Firebase Authentication 계정을 만든 뒤 Firestore에 다음 문서를 함께 생성한다.

```text
users/{학생 UID}
role: student
active: true
campus: suseong1 또는 suseong2
studentId: M001
name: 학생 이름
email: 내부 이메일
loginKey: suseong1_M001
mustChangePassword: true
```

계정 생성 실패 시 Authentication 계정만 남지 않도록 생성된 계정을 정리한다.

## 배포

웹 화면은 GitHub Pages로 배포된다. 실제 학생 계정 생성은 Cloud Functions의 `createStudentAccount` 함수가 Firebase 프로젝트에 배포된 뒤 작동한다.

```bash
firebase deploy --only functions
```
