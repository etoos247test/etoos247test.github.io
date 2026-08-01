# 이투스247학원 대구수성 1관 테스트 홈페이지

동적 대문 + Firebase Authentication Google 로그인 + 승인 계정 확인 + 보호 대시보드로 구성한 GitHub Pages용 정적 프로젝트입니다.

## 포함 기능

- 반응형 동적 대문
- 실시간 시계·시간대별 메시지
- 스크롤 진행률·등장 애니메이션·공지 티커
- 학습 공간 탭·카드 틸트
- Firebase Google 팝업 로그인
- 모바일/팝업 차단 시 리디렉션 로그인 대체
- 공용 PC용 `SESSION` 로그인
- 첫 로그인 계정의 승인 요청 자동 등록
- `users/{uid}` 승인 문서 확인
- 승인 사용자 전용 대시보드
- Firestore 보안 규칙 예시

---

## 1. Firebase 프로젝트 만들기

1. Firebase Console에 Google 계정으로 로그인합니다.
2. `프로젝트 추가`를 눌러 프로젝트를 만듭니다.
3. 프로젝트 개요에서 웹 아이콘 `</>`을 선택합니다.
4. 앱 이름 예시: `이투스247 대구수성1관 웹`
5. 웹 앱을 등록하고 화면에 표시되는 `firebaseConfig`를 복사합니다.

## 2. Google 로그인 활성화

Firebase Console에서:

`빌드 또는 보안 → Authentication → Sign-in method → Google → 사용 설정`

지원 이메일을 선택하고 저장합니다.

## 3. Firestore 만들기

Firebase Console에서:

`Firestore Database → 데이터베이스 만들기`

처음부터 공개 테스트 모드를 오래 사용하지 말고, 데이터베이스를 만든 직후 이 프로젝트의 `firestore.rules` 내용을 규칙 화면에 붙여넣어 게시합니다.

## 4. Firebase 설정값 입력

`assets/js/firebase-config.js`를 열고 다음 자리표시자를 Firebase Console의 실제 값으로 교체합니다.

```js
export const firebaseConfig = {
  apiKey: "실제 값",
  authDomain: "실제 값",
  projectId: "실제 값",
  storageBucket: "실제 값",
  messagingSenderId: "실제 값",
  appId: "실제 값"
};
```

Firebase 웹 설정의 `apiKey`는 브라우저 코드에 포함되는 프로젝트 식별 정보입니다. 실제 자료 보호는 Firestore Security Rules와 사용자 권한 문서로 수행합니다.

## 5. 승인 도메인 등록

Firebase Console:

`Authentication → Settings → Authorized domains`

다음을 추가합니다.

- `etoos247test.github.io`
- 나중에 연결할 사용자 정의 도메인
- 테스트 시 필요한 로컬 도메인

프로토콜(`https://`)과 경로는 쓰지 않고 도메인만 입력합니다.

## 6. 첫 관리자 승인

1. 홈페이지에서 관리자 본인의 Google 계정으로 한 번 로그인합니다.
2. Firestore에 `accessRequests/{UID}` 문서가 자동 생성됩니다.
3. 해당 UID를 복사합니다.
4. Firestore에서 `users` 컬렉션을 만들고 문서 ID를 그 UID로 지정합니다.
5. 다음 필드를 추가합니다.

| 필드 | 유형 | 값 |
|---|---|---|
| active | boolean | true |
| role | string | admin |
| email | string | 관리자 Google 이메일 |
| displayName | string | 관리자 이름 |

6. 새로고침 후 관리자 계정으로 다시 로그인합니다.

학생 승인 시에는 같은 방식으로 `role`을 `student`, 교직원은 `staff`로 지정합니다.

## 7. GitHub Pages에 게시

권장 저장소 이름:

`etoos247test.github.io`

저장소 루트에 이 프로젝트의 모든 파일을 올린 뒤:

`Settings → Pages → Deploy from a branch → main / root`

게시 주소:

`https://etoos247test.github.io/`

별도 프로젝트 저장소 이름을 쓴다면 주소는 `https://etoos247test.github.io/저장소명/`이 되며, 현재 상대경로 구조로 그대로 작동합니다.

## 8. ChatGPT에서 저장소 작업 권한 주기

새 저장소를 만든 뒤 ChatGPT GitHub 앱 설치 설정에서 해당 저장소를 허용해야 합니다. 저장소가 허용되면 이후 파일 수정·추가 작업을 직접 반영할 수 있습니다.

## 보안 원칙

- GitHub 저장소나 HTML에 학생 개인정보를 넣지 않습니다.
- HTML을 숨기는 것만으로 접근을 제한하지 않습니다.
- 개인정보와 상담 결과는 Firestore에 저장하고 Security Rules로 제한합니다.
- 관리자용 비밀키나 Firebase Admin SDK 서비스 계정 키를 프런트엔드에 넣지 않습니다.
- 공용 PC에서는 작업 후 반드시 로그아웃하고 브라우저를 닫습니다.

## 현재 공식 지점 정보 반영

- 학원명: 이투스247학원 대구수성 1관
- 전화: 053-7420-247
- 주소: 대구광역시 수성구 달구벌대로 2538 2층
- 이메일: etoos247dsm@naver.com

운영 정보가 변경되면 `index.html`의 연락처 영역을 수정하세요.
