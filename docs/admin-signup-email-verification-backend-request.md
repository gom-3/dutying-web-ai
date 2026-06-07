# 관리자 이메일/PW 가입 이메일 인증 백엔드·DB 요청

## 배경

현재 프론트의 관리자 이메일/PW 가입 흐름은 이메일 인증 요청 응답의 `debugVerificationToken`을 그대로 화면 상태에 저장한 뒤 가입 요청에 전달합니다. 이 방식은 사용자가 실제로 이메일을 소유했는지 확인하지 못하므로, 이메일 인증으로 보기 어렵습니다.

듀팅 웹은 병원/병동 관리자 SaaS입니다. 가입 이메일은 로그인 식별자이자 관리자 초대 매칭에 쓰일 수 있으므로, 계정 생성 전에 이메일 소유 확인이 끝나야 합니다.

## 목표 정책

- 관리자 이메일/PW 가입은 가입 전 이메일 인증을 필수로 한다.
- 인증 방식은 6자리 숫자 코드 입력 방식으로 한다.
- 이메일 인증 발송 API는 코드, 토큰, 디버그 토큰 등 인증 비밀값을 응답으로 내려주지 않는다.
- 계정 생성은 서버가 발급한 1회성 `signupToken`이 유효할 때만 허용한다.
- 가입 완료 후 인증 건은 재사용할 수 없도록 소비 처리한다.

## 사용자 흐름

1. 사용자가 `/signup`에서 이메일을 입력한다.
2. `인증코드 받기`를 누른다.
3. 서버가 6자리 인증코드를 생성하고 이메일로 보낸다.
4. 사용자가 화면에 인증코드를 입력한다.
5. 프론트가 코드 검증 API를 호출한다.
6. 서버가 코드가 맞으면 가입용 `signupToken`을 발급한다.
7. 사용자가 이름/비밀번호를 입력하고 계정을 만든다.
8. 서버는 `signupToken`을 검증한 뒤 계정을 생성하고 인증 건을 소비 처리한다.
9. 가입 성공 후 access token을 발급한다.

## API 요청

### 1. 이메일 인증코드 발송

`POST /auth/admin/email-verifications`

Request:

```json
{
    "email": "admin@example.com"
}
```

Response:

```json
{
    "email": "admin@example.com",
    "expiresAt": "2026-06-07T12:10:00+09:00",
    "resendAvailableAt": "2026-06-07T12:01:00+09:00"
}
```

Rules:

- 이메일은 `lower(trim(email))`로 정규화한다.
- 6자리 숫자 코드를 생성한다.
- 코드는 원문 저장하지 않고 hash로 저장한다.
- 같은 이메일과 `SIGNUP` purpose의 미소비 인증 건은 최신 건만 유효하게 한다.
- 이미 가입된 이메일이면 `409 EMAIL_ALREADY_USED`를 반환한다.
- 재발송은 30초 또는 60초 제한을 둔다.
- 응답에 `code`, `token`, `debugVerificationToken`을 포함하지 않는다.

Errors:

- `400 INVALID_EMAIL`
- `409 EMAIL_ALREADY_USED`
- `429 EMAIL_VERIFICATION_RATE_LIMITED`
- `500 EMAIL_SEND_FAILED`

### 2. 이메일 인증코드 검증

`POST /auth/admin/email-verifications/verify`

Request:

```json
{
    "email": "admin@example.com",
    "code": "123456"
}
```

Response:

```json
{
    "email": "admin@example.com",
    "signupToken": "one-time-signup-token",
    "expiresAt": "2026-06-07T12:20:00+09:00"
}
```

Rules:

- `email_normalized + purpose = SIGNUP`의 최신 유효 인증 건을 찾는다.
- `expires_at`이 지난 코드는 실패한다.
- `consumed_at`이 있는 인증 건은 실패한다.
- 코드 hash가 일치하면 `verified_at`을 기록한다.
- 검증 성공 시 짧은 만료 시간의 `signupToken`을 발급한다.
- `signupToken`도 원문 저장하지 않고 hash로 저장한다.
- 코드 실패 횟수는 증가시키고, 5회 실패 시 해당 인증 건을 잠근다.

Errors:

- `400 INVALID_EMAIL`
- `400 INVALID_VERIFICATION_CODE`
- `400 EMAIL_VERIFICATION_EXPIRED`
- `429 EMAIL_VERIFICATION_ATTEMPT_LIMITED`

### 3. 관리자 이메일/PW 가입

`POST /auth/admin/password/signup`

Request:

```json
{
    "name": "김관리",
    "email": "admin@example.com",
    "password": "password1234",
    "signupToken": "one-time-signup-token"
}
```

Response:

```json
{
    "accessToken": "jwt-access-token",
    "account": {
        "accountId": 1,
        "wardId": null,
        "email": "admin@example.com",
        "name": "김관리",
        "authProvider": "PASSWORD",
        "isManager": true,
        "status": "WORKSPACE_SETUP_PENDING",
        "emailVerifiedAt": "2026-06-07T12:05:00+09:00"
    }
}
```

Rules:

- `signupToken`은 필수다.
- `signupToken`이 유효하고, 만료되지 않았고, 아직 소비되지 않았고, 요청 이메일과 같은 인증 건에 연결되어 있어야 한다.
- 가입 성공 시 `accounts.email_verified_at`을 기록한다.
- 가입 성공 시 인증 건의 `consumed_at`을 기록한다.
- 비밀번호는 bcrypt/argon2 등 안전한 해시로 저장한다.
- 가입 성공 후 access token을 발급하고, 프론트는 `/register`로 이동한다.

Errors:

- `400 INVALID_SIGNUP_TOKEN`
- `400 SIGNUP_TOKEN_EXPIRED`
- `400 INVALID_PASSWORD`
- `400 INVALID_PROFILE`
- `409 EMAIL_ALREADY_USED`

## DB 요청

### accounts 변경

필드 추가 또는 확인:

| column | type | note |
| --- | --- | --- |
| email | varchar(255) not null | 원본 이메일 |
| email_normalized | varchar(255) not null | `lower(trim(email))` |
| email_verified_at | datetime nullable | 이메일 소유 확인 시각 |
| password_hash | varchar not null | PASSWORD 계정만 필수 |
| auth_provider | enum | `PASSWORD`, `KAKAO`, `APPLE` |
| status | enum | 가입 직후 `WORKSPACE_SETUP_PENDING` |

Indexes:

- `unique(email_normalized)` 또는 provider별 이메일 중복 정책에 맞는 unique/index
- `index(email_normalized)`

### admin_email_verifications 추가

| column | type | note |
| --- | --- | --- |
| email_verification_id | bigint PK | |
| email | varchar(255) not null | 원본 이메일 |
| email_normalized | varchar(255) not null | `lower(trim(email))` |
| purpose | enum not null | `SIGNUP` |
| code_hash | varchar not null | 6자리 코드 hash |
| signup_token_hash | varchar nullable | 검증 성공 후 발급한 가입 토큰 hash |
| status | enum not null | `PENDING`, `VERIFIED`, `CONSUMED`, `EXPIRED`, `LOCKED` |
| attempt_count | int not null default 0 | 코드 검증 실패 횟수 |
| resend_count | int not null default 0 | 재발송 횟수 |
| last_sent_at | datetime not null | 마지막 발송 시각 |
| expires_at | datetime not null | 코드 만료 시각 |
| signup_token_expires_at | datetime nullable | 가입 토큰 만료 시각 |
| verified_at | datetime nullable | 코드 검증 성공 시각 |
| consumed_at | datetime nullable | 가입 완료 소비 시각 |
| created_at / updated_at | datetime | |

Indexes:

- `index(email_normalized, purpose, status)`
- `index(expires_at)`
- `index(signup_token_hash)`

## 운영 정책

- 인증코드: 6자리 숫자
- 코드 만료: 10분 권장
- 가입 토큰 만료: 10~20분 권장
- 재발송 제한: 30초 또는 60초
- 코드 실패 제한: 5회
- 이메일 변경 시 기존 인증 상태는 프론트/백엔드 모두 초기화
- 운영/개발 환경 모두 인증 비밀값을 API 응답으로 내려주지 않음
- 개발 편의가 필요하면 별도 내부 도구나 서버 로그가 아닌 안전한 테스트 전용 API로 분리

## 프론트 기대 계약

프론트는 아래 세 API만 사용합니다.

1. `sendAdminEmailVerification({ email })`
2. `verifyAdminEmailVerification({ email, code })`
3. `passwordSignup({ name, email, password, signupToken })`

프론트는 `debugVerificationToken`을 읽지 않으며, 코드 검증 API가 성공하기 전에는 가입 버튼을 활성화하지 않습니다.
