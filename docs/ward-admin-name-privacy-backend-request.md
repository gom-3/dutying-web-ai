# 병동 관리자 이름 정보 응답 제외 요청

## 배경

병동 관리자 등록은 이메일 기반으로 처리합니다. 프론트엔드는 관리자 추가 시 이름, loginId, 초대자 이름을 입력받지 않고 아래 값만 전송합니다.

```json
{
  "email": "editor@example.com",
  "role": "EDITOR"
}
```

관리자 이름은 개인정보에 해당할 수 있으므로, 관리자 등록/목록 API 응답에서 이름 정보를 내려주지 않도록 백엔드 변경을 요청합니다.

## 요청 사항

- 관리자 이메일 등록 응답에 `name`, `invitedName`, `adminName` 등 이름 계열 필드를 포함하지 않습니다.
- 관리자 목록 응답의 `members` 항목에도 `name`을 포함하지 않습니다.
- 예약 이메일 목록인 `reservedEmails`에는 기존처럼 이메일과 권한 상태만 내려줍니다.
- 프론트엔드는 이름 없이 이메일만으로 관리자 목록을 표시할 수 있습니다.

## 대상 API

```http
POST /admin/wards/{wardId}/admin-emails
GET /admin/wards/{wardId}/admins
```

Legacy 호환 API가 유지된다면 아래 경로에도 동일하게 적용해 주세요.

```http
POST /wards/{wardId}/admin-emails
GET /wards/{wardId}/admins
```

## 권장 응답 예시

### 등록 응답: 기존 가입 계정이 있는 경우

```json
{
  "wardId": 273,
  "email": "editor@example.com",
  "role": "EDITOR",
  "status": "ACTIVE",
  "membershipId": 201,
  "accountId": 55
}
```

### 등록 응답: 아직 가입하지 않은 이메일인 경우

```json
{
  "emailRegistrationId": 301,
  "wardId": 273,
  "email": "future-editor@example.com",
  "role": "EDITOR",
  "status": "RESERVED"
}
```

### 목록 응답

```json
{
  "members": [
    {
      "membershipId": 201,
      "accountId": 55,
      "wardId": 273,
      "email": "editor@example.com",
      "role": "EDITOR",
      "status": "ACTIVE"
    }
  ],
  "reservedEmails": [
    {
      "emailRegistrationId": 301,
      "wardId": 273,
      "email": "future-editor@example.com",
      "role": "EDITOR",
      "status": "RESERVED"
    }
  ],
  "invitations": []
}
```

## 제외해야 하는 필드

아래 필드는 관리자 등록/목록 응답에서 제거하거나 내려주지 않는 것을 권장합니다.

- `name`
- `invitedName`
- `adminName`
- 기타 사용자 실명 또는 표시 이름으로 해석될 수 있는 필드

## 프론트엔드 처리 기준

- 활성 관리자와 예약 관리자는 모두 이메일 기준으로 표시합니다.
- 역할 배지는 `role` 값을 기준으로 표시합니다.
- `OWNER`는 목록 최상단에 정렬합니다.
- 예약 관리자도 `role: "EDITOR"`이면 `관리자` 배지로 표시합니다.

## QA 체크리스트

- 관리자 이메일 등록 응답에 이름 필드가 포함되지 않는다.
- 관리자 목록 응답의 `members`에 이름 필드가 포함되지 않는다.
- 기존 가입 계정 관리자도 이메일만으로 목록에 표시된다.
- 예약 이메일 관리자도 이메일만으로 목록에 표시된다.
- 프론트 화면에서 이름 없이 관리자 추가/삭제가 정상 동작한다.
