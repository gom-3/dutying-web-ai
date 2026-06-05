# 관리자 계정/병동 온보딩 백엔드·DB 구현 명세

## 1. 최종 제품 정책

- 웹은 병원/병동 관리자 전용 SaaS다.
- 가입은 항상 계정부터 만든다. 계정 생성 직후에는 아직 병동에 소속되지 않은 상태다.
- 로그인한 계정이 병동이 없으면 `/onboarding`에서 두 가지를 선택한다.
    - 새 병동 만들기
    - 기존 병동 들어가기
- 새 병동 만들기는 항상 새 고객 단위를 생성한다. 같은 병원명/병동명이 이미 있어도 중복 생성 허용.
- 고객 단위는 `hospitalName + wardName`이거나 `hospitalName` 단독이다. 병동이 없는 병원/기관도 가능해야 한다.
- 기존 병동 들어가기는 병동코드만으로는 입장할 수 없다. 병동코드는 병동을 찾는 용도이고, 최고 관리자가 미리 등록한 계정만 들어갈 수 있다.
- 병동에는 `OWNER` 최고 관리자 1명 이상과 `EDITOR` 관리자 여러 명이 있을 수 있다.
- `OWNER`만 관리자를 추가/초대/제거할 수 있다.
- `EDITOR`는 근무표 작성만이 아니라 게시판, 근무자, 근무 설정 등 운영 기능을 함께 사용할 수 있다.

## 2. 프론트 라우트와 현재 API 계약

프론트는 아래 흐름으로 구현되어 있다.

- `/sign-in`: 관리자 로그인. ID/PW 로그인, 카카오/Apple 계속하기.
- `/sign-up`: 관리자 계정 만들기. ID/PW 계정 생성, 카카오/Apple 시작하기.
- `/login`: 레거시 호환. `/sign-in`으로 redirect.
- `/oauth2/redirect`: OAuth 콜백. 신규 소셜 계정이면 `/onboarding`으로 이동.
- `/onboarding`: 새 병동 만들기 또는 기존 병동 들어가기 선택.
- `/onboarding/create-ward`: 병원/병동 생성. 현재 계정이 `OWNER`.
- `/onboarding/join-ward`: 병동코드 입력. 미리 등록된 관리자만 `EDITOR`로 입장.
- `/ward-settings/admins`: 최고 관리자용 관리자 관리 화면.

프론트가 호출하는 신규/변경 API:

- `POST /auth/password/signup`
- `POST /auth/password/login`
- `GET /accounts/me`
- `POST /accounts/me/admin-workspace`
- `POST /wards/join-by-code`
- `GET /wards/{wardId}/admins`
- `POST /wards/{wardId}/admins/by-login-id`
- `POST /wards/{wardId}/admin-invitations`
- `POST /wards/{wardId}/admin-invitations/{invitationId}/resend`
- `DELETE /wards/{wardId}/admin-invitations/{invitationId}`
- `DELETE /wards/{wardId}/admins/{membershipId}`

## 3. 권장 DB 모델

### accounts

로그인 주체다. ID/PW와 소셜 계정을 모두 같은 테이블에서 관리한다.

| column                  | type                        | note                                              |
| ----------------------- | --------------------------- | ------------------------------------------------- |
| account_id              | bigint PK                   |                                                   |
| login_id                | varchar(40) unique nullable | ID/PW 계정만 필수. 소문자 정규화 추천             |
| password_hash           | varchar nullable            | ID/PW 계정만 필수                                 |
| email                   | varchar(255) nullable       | 소셜 계정은 provider email 저장. 초대 매칭에 사용 |
| email_normalized        | varchar(255) nullable index | lower(trim(email))                                |
| name                    | varchar(40)                 | 관리자 이름                                       |
| phone_num               | varchar(20) nullable        | 숫자만 저장 추천                                  |
| profile_img_url         | text nullable               |                                                   |
| auth_provider           | enum                        | `PASSWORD`, `KAKAO`, `APPLE`                      |
| provider_user_id        | varchar nullable            | 소셜 provider 식별자                              |
| status                  | enum                        | `WORKSPACE_SETUP_PENDING`, `LINKED`, `DEMO`       |
| current_ward_id         | bigint nullable FK          | 현재 프론트 호환용. 기존 `wardId`로 내려도 됨     |
| created_at / updated_at | datetime                    |                                                   |

Unique indexes:

- `unique(login_id)` where login_id is not null
- `unique(auth_provider, provider_user_id)` where provider_user_id is not null
- `index(email_normalized)`

기존 status 호환:

- 기존 `INITIAL`, `NURSE_INFO_PENDING`, `WARD_SELECT_PENDING`, `WARD_ENTRY_PENDING`은 웹 관리자 플로우에서는 모두 `WORKSPACE_SETUP_PENDING`처럼 처리해도 된다.

### wards

현재 코드의 `Ward`가 고객 데이터 경계다.

| column                  | type                        | note                                         |
| ----------------------- | --------------------------- | -------------------------------------------- |
| ward_id                 | bigint PK                   |                                              |
| hospital_name           | varchar(80) not null        | 병원/기관명                                  |
| name                    | varchar(80) not null        | 병동명이 없으면 hospital_name 복사 저장 권장 |
| ward_name               | varchar(80) nullable        | 선택. 스키마 변경이 어렵다면 name만 사용     |
| code                    | varchar(12) unique not null | 병동 찾기/간호사 연동용. 서버 생성           |
| created_by_account_id   | bigint FK                   | 최초 OWNER                                   |
| created_at / updated_at | datetime                    |                                              |

Rules:

- `hospital_name + name` 중복은 허용한다.
- 병동코드는 관리자 입장 권한이 아니다. 권한 확인은 membership 또는 invitation으로 한다.

### ward_admin_memberships

계정이 병동에서 어떤 관리자 권한을 갖는지 나타낸다.

| column                  | type               | note                |
| ----------------------- | ------------------ | ------------------- |
| membership_id           | bigint PK          |                     |
| ward_id                 | bigint FK not null |                     |
| account_id              | bigint FK not null |                     |
| role                    | enum not null      | `OWNER`, `EDITOR`   |
| status                  | enum not null      | `ACTIVE`            |
| created_by_account_id   | bigint FK nullable | OWNER가 추가한 경우 |
| created_at / updated_at | datetime           |                     |

Indexes:

- `unique(ward_id, account_id)`
- `index(account_id)`
- `index(ward_id, role)`

권장:

- DB는 한 계정이 여러 병동 membership을 가질 수 있게 설계한다.
- 현재 프론트는 하나의 현재 병동만 보여주므로, 새 병동에 들어가면 `accounts.current_ward_id`를 해당 병동으로 갱신한다.
- 병동 전환 UI는 후속 작업으로 추가할 수 있다.

### ward_admin_invitations

이메일로 관리자 권한을 예약하고 안내 메일을 보내는 테이블이다.

| column                   | type                  | note                                         |
| ------------------------ | --------------------- | -------------------------------------------- |
| invitation_id            | bigint PK             |                                              |
| ward_id                  | bigint FK not null    |                                              |
| invited_email            | varchar(255) not null | 원본                                         |
| invited_email_normalized | varchar(255) not null | lower(trim(email))                           |
| invited_name             | varchar(40) nullable  |                                              |
| role                     | enum not null         | 현재는 `EDITOR`만 허용                       |
| status                   | enum not null         | `PENDING`, `ACCEPTED`, `CANCELED`, `EXPIRED` |
| invited_by_account_id    | bigint FK not null    | OWNER                                        |
| accepted_by_account_id   | bigint FK nullable    | 수락한 계정                                  |
| accepted_at              | datetime nullable     |                                              |
| expires_at               | datetime not null     | 추천 14일                                    |
| created_at / updated_at  | datetime              |                                              |

Indexes:

- `index(ward_id, status)`
- `index(invited_email_normalized, status)`
- `unique(ward_id, invited_email_normalized, status)`는 DB별 partial unique가 가능하면 `PENDING`에만 적용 추천.

중요:

- 초대 메일에 토큰 링크가 없어도 된다. 권한의 기준은 링크가 아니라 `invited_email_normalized`와 로그인 계정의 `email_normalized` 매칭이다.
- 이메일에는 병동명, 병동코드, 로그인/가입 경로를 보낸다.
- 토큰 기반 원클릭 수락을 나중에 추가해도 되지만 MVP 필수는 아니다.

### optional: admin_permission_audit_logs

관리자 권한 변경은 병원 SaaS에서 민감한 작업이므로 로그를 권장한다.

| column                   | type               | note                                                                                                 |
| ------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------- |
| audit_id                 | bigint PK          |                                                                                                      |
| ward_id                  | bigint FK          |                                                                                                      |
| actor_account_id         | bigint FK          |                                                                                                      |
| target_account_id        | bigint FK nullable |                                                                                                      |
| invitation_id            | bigint FK nullable |                                                                                                      |
| action                   | varchar            | `ADD_BY_LOGIN_ID`, `INVITE_EMAIL`, `RESEND_INVITE`, `CANCEL_INVITE`, `REMOVE_ADMIN`, `ACCEPT_INVITE` |
| before_json / after_json | json nullable      |                                                                                                      |
| created_at               | datetime           |                                                                                                      |

## 4. 권한 모델

### Role

`OWNER`

- 병동 전체 운영 가능
- 근무표, 신청근무, 게시판, 근무자, 근무 설정, 병동 설정 가능
- 관리자 추가/초대/제거 가능
- 추후 결제/구독/병동 삭제/소유권 이전 가능

`EDITOR`

- 병동 운영 기능 가능
- 근무표 작성/수정, 신청근무 검토, 게시판 작성/관리, 근무자 관리, 근무 설정 가능
- 관리자 추가/초대/제거 불가
- 결제/구독/소유권 이전/병동 삭제 불가

권장 permission 응답:

```json
{
    "role": "OWNER",
    "permissions": [
        "DUTY_MANAGE",
        "REQUEST_MANAGE",
        "BOARD_MANAGE",
        "MEMBER_MANAGE",
        "WARD_SETTING_MANAGE",
        "ADMIN_MANAGE",
        "BILLING_MANAGE"
    ]
}
```

프론트 호환:

- `/accounts/me`는 기존 `isManager = true`를 유지한다.
- `role`과 `permissions`를 추가로 내려주면 프론트에서 OWNER 전용 화면을 더 정확히 막을 수 있다.

## 5. API 상세

### 5.1 ID/PW 계정 생성

`POST /auth/password/signup`

계정만 만든다. 병원/병동은 만들지 않는다.

Request:

```json
{
    "loginId": "headnurse_7a",
    "password": "password1234",
    "name": "김관리",
    "phoneNum": "01012341234",
    "email": "head@example.com"
}
```

Response:

```json
{
    "accessToken": "jwt-access-token",
    "account": {
        "accountId": 1,
        "nurseId": null,
        "wardId": null,
        "shiftTeamId": null,
        "email": "head@example.com",
        "name": "김관리",
        "phoneNum": "01012341234",
        "profileImgUrl": "",
        "authProvider": "PASSWORD",
        "isManager": true,
        "status": "WORKSPACE_SETUP_PENDING"
    }
}
```

Rules:

- `loginId`: 4~40자, 영문/숫자/`.`/`_`/`-`.
- `loginId`는 lower-case 저장 추천.
- `password`: 최소 8자 이상, bcrypt/argon2 등 안전한 해시.
- `email`은 초대 매칭에 쓰므로 가능하면 필수로 받는다.
- 가입 성공 후 바로 access token을 발급한다.
- 가입 후 프론트는 `/onboarding`으로 이동한다.

Errors:

- `409 LOGIN_ID_ALREADY_EXISTS`
- `409 EMAIL_ALREADY_USED` 선택. 같은 이메일로 여러 provider를 허용할지 정책 결정 필요
- `400 INVALID_LOGIN_ID`
- `400 INVALID_PASSWORD`
- `400 INVALID_EMAIL`
- `400 INVALID_PROFILE`

### 5.2 ID/PW 로그인

`POST /auth/password/login`

Request:

```json
{
    "loginId": "headnurse_7a",
    "password": "password1234"
}
```

Response:

```json
{
    "accessToken": "jwt-access-token",
    "account": {
        "accountId": 1,
        "wardId": 10,
        "name": "김관리",
        "email": "head@example.com",
        "isManager": true,
        "status": "LINKED",
        "role": "OWNER",
        "permissions": ["DUTY_MANAGE", "BOARD_MANAGE", "MEMBER_MANAGE", "ADMIN_MANAGE"]
    }
}
```

Errors:

- `401 INVALID_CREDENTIALS`
- `403 ACCOUNT_DISABLED`

### 5.3 소셜 로그인/가입

OAuth 콜백에서 provider 프로필을 받은 뒤 서버가 분기한다.

1. `auth_provider + provider_user_id` 계정이 있고 `LINKED`이면 로그인.
2. 계정은 있지만 `WORKSPACE_SETUP_PENDING`이면 로그인 후 `/onboarding`.
3. 계정이 없으면 소셜 account를 생성하고 `/onboarding`.

신규 소셜 계정 저장 예:

```json
{
    "authProvider": "KAKAO",
    "providerUserId": "123456",
    "email": "head@example.com",
    "name": "김관리",
    "profileImgUrl": "https://cdn.example.com/profile.png",
    "status": "WORKSPACE_SETUP_PENDING"
}
```

OAuth redirect:

```text
{APP_URL}/oauth2/redirect
  ?accessToken={jwt}
  &nextPageUrl={APP_URL}/onboarding
  &socialSignupRequired=true
  &provider=KAKAO
  &accountStatus=WORKSPACE_SETUP_PENDING
```

프로필 프리필:

- 권장: provider에서 받은 `name`, `email`, `profileImgUrl`을 account에 저장하고 `/accounts/me`로 내려준다.
- 선택: redirect query에 `socialName`, `socialEmail`, `socialProfileImgUrl`를 같이 보낼 수 있다.
- Apple은 이름이 최초 승인 시점에만 올 수 있으므로 콜백 시점에 반드시 저장한다.

### 5.4 내 계정 조회

`GET /accounts/me`

Response:

```json
{
    "accountId": 1,
    "nurseId": null,
    "wardId": 10,
    "shiftTeamId": null,
    "email": "head@example.com",
    "name": "김관리",
    "phoneNum": "01012341234",
    "profileImgUrl": "",
    "authProvider": "PASSWORD",
    "isManager": true,
    "status": "LINKED",
    "role": "OWNER",
    "permissions": ["DUTY_MANAGE", "REQUEST_MANAGE", "BOARD_MANAGE", "MEMBER_MANAGE", "WARD_SETTING_MANAGE", "ADMIN_MANAGE"],
    "memberships": [
        {
            "membershipId": 100,
            "wardId": 10,
            "role": "OWNER",
            "status": "ACTIVE"
        }
    ]
}
```

Rules:

- `wardId`는 현재 프론트 호환을 위해 `current_ward_id`를 내려준다.
- 현재 병동이 있으면 해당 병동의 `role`, `permissions`를 같이 내려준다.
- 병동이 없으면 `wardId = null`, `status = WORKSPACE_SETUP_PENDING`.

### 5.5 새 병동 만들기

`POST /accounts/me/admin-workspace`

인증된 계정이 새 병원/병동 고객 단위를 만들고 본인을 `OWNER`로 등록한다.

Request:

```json
{
    "hospitalName": "듀팅병원",
    "wardName": "7A",
    "adminName": "김관리",
    "phoneNum": "01012341234",
    "includeAdminAsWorker": false,
    "profileImgUrl": "",
    "wardShiftTypes": [
        {
            "name": "데이",
            "shortName": "D",
            "startTime": "07:00",
            "endTime": "15:00",
            "color": "#4DC2AD",
            "isDefault": true,
            "isOff": false,
            "isCounted": true,
            "classification": "DAY"
        }
    ],
    "shiftTeams": [
        {
            "name": "A팀",
            "nurseNames": ["홍길동"],
            "nurses": [
                {
                    "name": "홍길동",
                    "memo": "프리셉터",
                    "isWorker": true,
                    "employmentDate": "2026-06-05",
                    "level": 2,
                    "possibleShiftShortNames": ["D"]
                }
            ]
        }
    ]
}
```

`wardName`은 null 또는 빈 문자열 가능.
온보딩 병동 생성은 마지막 완료 버튼에서 이 요청 한 번으로 병동, 근무유형, 팀, 간호사를 함께 생성한다.

Response:

```json
{
    "account": {
        "accountId": 1,
        "nurseId": null,
        "wardId": 10,
        "shiftTeamId": null,
        "email": "head@example.com",
        "name": "김관리",
        "phoneNum": "01012341234",
        "profileImgUrl": "",
        "isManager": true,
        "status": "LINKED",
        "role": "OWNER",
        "permissions": ["DUTY_MANAGE", "BOARD_MANAGE", "MEMBER_MANAGE", "ADMIN_MANAGE"]
    },
    "ward": {
        "wardId": 10,
        "hospitalName": "듀팅병원",
        "name": "7A",
        "code": "A7K29Q",
        "nurseCnt": 0,
        "wardShiftTypes": [],
        "shiftTeams": []
    }
}
```

Transaction:

1. account row lock.
2. account profile update: `name`, `phone_num`, `profile_img_url`.
3. ward 생성. `code`는 서버가 unique 생성.
4. 요청의 `wardShiftTypes`, `shiftTeams`, `nurses`를 같은 transaction 안에서 생성. 값이 비어 있으면 기본 shift type / 기본 shift team 생성.
5. `ward_admin_memberships` 생성: `role = OWNER`.
6. `accounts.current_ward_id = ward_id`, `status = LINKED`.
7. `includeAdminAsWorker = true`면 nurse 생성 및 account 연결.
8. account + ward 응답.

Rules:

- 기존 병원/병동명과 중복되어도 생성한다.
- 이미 같은 계정이 다른 병동에 속해 있어도 새 병동 생성은 허용할 수 있다. 생성한 병동을 current ward로 설정한다.
- 동일 계정의 병동 생성 남용 방지를 위해 rate limit 권장.

Errors:

- `400 INVALID_HOSPITAL_NAME`
- `400 INVALID_WARD_NAME`
- `400 INVALID_ADMIN_PROFILE`
- `409 ACCOUNT_NOT_READY` 선택

### 5.6 병동코드로 기존 병동 들어가기

`POST /wards/join-by-code`

Request:

```json
{
    "code": "A7K29Q"
}
```

Response:

```json
{
    "account": {
        "accountId": 2,
        "wardId": 10,
        "name": "이관리",
        "email": "editor@example.com",
        "isManager": true,
        "status": "LINKED",
        "role": "EDITOR",
        "permissions": ["DUTY_MANAGE", "REQUEST_MANAGE", "BOARD_MANAGE", "MEMBER_MANAGE", "WARD_SETTING_MANAGE"]
    },
    "ward": {
        "wardId": 10,
        "hospitalName": "듀팅병원",
        "name": "7A",
        "code": "A7K29Q"
    },
    "membership": {
        "membershipId": 200,
        "accountId": 2,
        "wardId": 10,
        "role": "EDITOR",
        "status": "ACTIVE",
        "createdAt": "2026-05-27T09:00:00.000Z"
    }
}
```

Join decision:

1. `code`로 ward 조회. 없으면 `404 WARD_NOT_FOUND`.
2. 현재 계정이 이미 해당 ward의 active membership이면 current ward만 갱신하고 성공.
3. 현재 계정의 `login_id`로 사전 등록된 membership이 있으면 current ward 갱신 후 성공.
4. 현재 계정의 `email_normalized`와 같은 `PENDING` invitation이 있으면 invitation을 `ACCEPTED`로 바꾸고 membership 생성 후 성공.
5. 어느 조건도 없으면 `403 NOT_REGISTERED_ADMIN`.

Important:

- 병동코드는 공개되어도 괜찮다. 권한 판단은 membership/invitation에서 한다.
- 이메일 초대받은 사람이 카카오/Apple로 로그인해도 provider email이 같으면 입장 가능해야 한다.
- 초대 이메일과 계정 이메일이 다른 경우에는 입장 불가. OWNER가 새 이메일로 다시 초대해야 한다.

Errors:

- `404 WARD_NOT_FOUND`
- `403 NOT_REGISTERED_ADMIN`
- `409 INVITATION_EXPIRED`
- `409 INVITATION_CANCELED`

### 5.7 관리자 목록 조회

`GET /wards/{wardId}/admins`

Authorization:

- current account must have active membership in ward.
- MVP에서는 `OWNER`만 허용해도 된다. `EDITOR`에게 목록 읽기만 허용하려면 민감 정보 범위를 줄인다.

Response:

```json
{
    "members": [
        {
            "membershipId": 100,
            "accountId": 1,
            "wardId": 10,
            "role": "OWNER",
            "status": "ACTIVE",
            "name": "김관리",
            "loginId": "headnurse_7a",
            "email": "head@example.com",
            "createdAt": "2026-05-27T09:00:00.000Z"
        }
    ],
    "invitations": [
        {
            "invitationId": 300,
            "wardId": 10,
            "invitedEmail": "editor@example.com",
            "invitedName": "이관리",
            "role": "EDITOR",
            "status": "PENDING",
            "invitedByAccountId": 1,
            "expiresAt": "2026-06-10T09:00:00.000Z",
            "createdAt": "2026-05-27T09:00:00.000Z"
        }
    ]
}
```

### 5.8 아이디로 관리자 추가

`POST /wards/{wardId}/admins/by-login-id`

OWNER 전용.

Request:

```json
{
    "loginId": "editor_7a",
    "role": "EDITOR"
}
```

Response:

```json
{
    "membershipId": 201,
    "accountId": 2,
    "wardId": 10,
    "role": "EDITOR",
    "status": "ACTIVE",
    "name": "이관리",
    "loginId": "editor_7a",
    "email": "editor@example.com",
    "createdAt": "2026-05-27T09:00:00.000Z"
}
```

Rules:

- `OWNER`만 호출 가능.
- role은 현재 `EDITOR`만 허용. OWNER 추가/이전은 별도 기능으로 분리.
- loginId 계정이 없으면 `404 ACCOUNT_NOT_FOUND`.
- 이미 같은 ward membership이 있으면 `409 ADMIN_ALREADY_EXISTS`.
- 다른 ward membership이 있어도 추가 가능. 추가 후 대상 계정이 다음에 로그인/입장하면 current ward를 선택 또는 갱신한다.
- 대상 계정에게 알림/이메일을 보낼 수 있으면 권장.

### 5.9 이메일로 관리자 초대

`POST /wards/{wardId}/admin-invitations`

OWNER 전용.

Request:

```json
{
    "invitedEmail": "editor@example.com",
    "invitedName": "이관리",
    "role": "EDITOR"
}
```

Response:

```json
{
    "invitationId": 300,
    "wardId": 10,
    "invitedEmail": "editor@example.com",
    "invitedName": "이관리",
    "role": "EDITOR",
    "status": "PENDING",
    "invitedByAccountId": 1,
    "expiresAt": "2026-06-10T09:00:00.000Z",
    "createdAt": "2026-05-27T09:00:00.000Z"
}
```

Rules:

- `OWNER`만 호출 가능.
- invitedEmail을 정규화해 저장한다.
- 같은 ward에 같은 이메일의 pending invitation이 있으면 새로 만들지 말고 기존 초대를 반환하거나 `409 INVITATION_ALREADY_EXISTS`.
- 같은 이메일 account가 이미 존재해도 바로 membership을 만들지 말고 invitation을 만들 수 있다. 사용자가 직접 로그인 후 병동코드를 입력하면 accepted 처리한다.
- 이메일 본문에는 병원/병동명, 병동코드, `/sign-in` 또는 `/sign-up` 진입 경로를 포함한다.
- 링크 자체가 권한이 되면 안 된다. 권한은 로그인 계정 이메일 매칭으로 확인한다.

Email content minimum:

```text
듀팅 관리자 초대
{hospitalName} {wardName} 관리자로 초대되었습니다.
병동코드: A7K29Q
1. 듀팅 웹에서 로그인 또는 회원가입
2. 기존 병동 들어가기 선택
3. 병동코드 입력

이 초대는 {expiresAt}까지 유효합니다.
```

### 5.10 초대 재발송

`POST /wards/{wardId}/admin-invitations/{invitationId}/resend`

OWNER 전용.

Rules:

- `PENDING` 상태만 재발송 가능.
- 만료된 초대는 새 `expires_at`로 갱신하거나 `409 INVITATION_EXPIRED` 반환 중 하나로 정책 결정.
- rate limit 권장.

### 5.11 초대 취소

`DELETE /wards/{wardId}/admin-invitations/{invitationId}`

OWNER 전용.

Rules:

- `PENDING`만 `CANCELED`로 변경.
- 이미 accepted된 초대는 취소할 수 없다. 필요한 경우 관리자 제거 API를 사용한다.

Response:

```text
204 No Content
```

### 5.12 관리자 제거

`DELETE /wards/{wardId}/admins/{membershipId}`

OWNER 전용.

Rules:

- `EDITOR` 제거 가능.
- OWNER 제거는 MVP에서 금지.
- 자기 자신 제거 금지.
- 마지막 OWNER 제거 금지.
- 제거된 계정이 해당 ward를 current ward로 보고 있으면 `current_ward_id`를 null 또는 다른 active ward로 변경한다.

Response:

```text
204 No Content
```

Errors:

- `403 OWNER_ONLY`
- `403 CANNOT_REMOVE_SELF`
- `403 CANNOT_REMOVE_OWNER`
- `404 MEMBERSHIP_NOT_FOUND`

## 6. 기존 API와의 관계

관리자 웹의 새 흐름에서는 아래 레거시 입장 플로우를 사용하지 않는다.

- `GET /wards/search?code=...`
- `POST /wards/{wardId}/waiting-nurses`
- `POST /wards/{wardId}/waiting-nurses/{waitingNurseId}/approve`
- `POST /wards/{wardId}/waiting-nurses/{waitingNurseId}/connect`

위 API는 일반 간호사 앱 연동, 미연동 간호사 연결, 기존 모바일 플로우 용도로 유지한다.

기존 `POST /auth/password/signup-workspace`는 새 프론트에서 사용하지 않는다. 서버가 당장 제거하기 어렵다면 레거시로만 유지한다.

## 7. 백엔드 구현 순서 추천

1. account에 `WORKSPACE_SETUP_PENDING`, `email_normalized`, `current_ward_id`, `auth_provider`, `provider_user_id`, `phone_num` 정리.
2. `ward_admin_memberships`, `ward_admin_invitations` 테이블 추가.
3. `/auth/password/signup` 구현.
4. OAuth 신규 계정 생성 시 account만 만들고 `/onboarding`으로 redirect.
5. `/accounts/me`에 current ward role/permissions 추가.
6. `/accounts/me/admin-workspace`에서 ward + OWNER membership 생성.
7. `/wards/join-by-code`에서 code + membership/invitation 검증 구현.
8. 관리자 관리 API 구현.
9. 초대 메일 발송/재발송/취소 구현.
10. 관리자 권한 변경 audit log 추가.

## 8. 완료 기준

- ID/PW 회원가입은 계정만 만들고 `/onboarding`으로 이동한다.
- 소셜 신규 로그인은 provider 프로필을 저장하고 `/onboarding`으로 이동한다.
- 새 병동 만들기 완료 시 계정은 `OWNER`, `LINKED`, current ward 설정 상태가 된다.
- 기존 병동 들어가기는 병동코드만으로는 실패하고, 사전 등록된 loginId 또는 이메일 초대가 있을 때만 성공한다.
- 이메일 초대받은 사용자가 같은 이메일로 소셜 로그인해도 권한 매칭이 된다.
- OWNER만 관리자 추가/초대/제거 API를 호출할 수 있다.
- EDITOR는 운영 기능을 사용할 수 있지만 관리자 권한 관리는 할 수 없다.
- 병원/병동명 중복 생성은 허용된다.
- 한 계정이 여러 병동 membership을 가질 수 있도록 DB가 막지 않는다.
