# 병동 관리자 이메일 등록 백엔드 변경 요청

## 배경

병동 설정 화면에서 병동 관리자를 추가하는 UX를 단순화한다.

프론트는 더 이상 관리자 이름이나 아이디를 받지 않는다. 오너가 이메일만 등록하면, 해당 이메일로 가입된 계정 또는 이후 가입할 계정이 병동 입장 시 관리자 권한을 받을 수 있어야 한다.

## 최종 UX 정책

- 관리자 추가 입력값은 이메일 1개만 사용한다.
- 이름 입력은 없다.
- 아이디 입력은 없다.
- 초대 대기 목록은 화면에 노출하지 않는다.
- 등록된 관리자 목록은 보여준다.
- 활성 관리자와 예약 이메일을 합쳐 병동 관리자는 최대 10명까지만 등록할 수 있다.
- 관리자 삭제는 `OWNER`만 가능하다.
- `OWNER`는 삭제할 수 없고, `EDITOR` 관리자만 삭제 대상이다.

## 프론트 요청 형태

권장 신규 API:

```http
POST /wards/{wardId}/admin-emails
```

Request:

```json
{
  "email": "editor@example.com",
  "role": "EDITOR"
}
```

기존 API 경로를 유지해야 한다면 아래도 가능하다.

```http
POST /wards/{wardId}/admin-invitations
```

Request:

```json
{
  "invitedEmail": "editor@example.com",
  "role": "EDITOR"
}
```

중요: `invitedName`, `name`, `loginId`는 받지 않는다. 특히 `invitedName`은 required 검증에서 제거해야 한다.

## 백엔드 처리 규칙

1. 요청자는 해당 병동의 `OWNER`여야 한다.
2. 이메일은 `lower(trim(email))` 형태로 정규화해서 저장하고 매칭한다.
3. 이메일 형식이 아니면 `400 INVALID_EMAIL` 또는 기존 validation error를 반환한다.
4. 같은 병동에 같은 정규화 이메일이 이미 등록되어 있으면 중복으로 만들지 않는다.
5. 이미 등록된 활성 관리자와 예약 이메일을 합쳐 10명이면 새 등록을 거부한다.
6. 해당 이메일을 가진 계정이 이미 있으면 즉시 `ward_admin_memberships`를 생성하거나 활성화한다.
7. 해당 이메일을 가진 계정이 없으면 이메일 기준으로 관리자 권한을 예약 저장한다.
8. 이후 해당 이메일로 가입한 계정이 병동 입장을 시도하면 예약 정보를 찾아 `EDITOR` 권한으로 병동에 입장시킨다.
9. 예약 정보는 메일 초대 수락 여부와 무관하게 권한 매칭의 기준이 되어야 한다.

## 상태 모델 권장

기존 `ward_admin_invitations`를 계속 써도 되지만, 의미는 "초대 대기"보다 "관리자 이메일 예약"에 가깝다.

권장 status:

- `ACTIVE`: 이미 계정과 연결되어 관리자 권한이 활성화됨
- `RESERVED`: 아직 연결된 계정은 없지만 이메일 권한 예약됨
- `REMOVED`: 오너가 삭제함

기존 `PENDING`을 유지한다면 프론트에는 노출하지 않아도 된다. 다만 입장 매칭 시 `PENDING` 상태를 권한 예약으로 취급해야 한다.

## 응답 예시

이미 계정이 있어 바로 활성화된 경우:

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

아직 계정이 없어 예약된 경우:

```json
{
  "wardId": 273,
  "email": "editor@example.com",
  "role": "EDITOR",
  "status": "RESERVED"
}
```

## 관리자 목록 조회

프론트는 등록된 관리자 목록만 보여준다.

```http
GET /wards/{wardId}/admins
```

응답에는 활성 관리자와 이메일 예약 관리자를 함께 내려주는 것을 권장한다.

예시:

```json
{
  "members": [
    {
      "membershipId": 201,
      "accountId": 55,
      "name": "이관리",
      "email": "editor@example.com",
      "role": "EDITOR"
    }
  ],
  "reservedEmails": [
    {
      "email": "future-editor@example.com",
      "role": "EDITOR",
      "status": "RESERVED"
    }
  ]
}
```

기존 응답의 `invitations` 필드를 유지해도 되지만, 프론트 화면에서는 "초대 대기" 섹션으로 분리하지 않는다.

## 삭제 API

관리자 삭제는 `OWNER`만 가능하다.

활성 관리자 삭제:

```http
DELETE /wards/{wardId}/admins/{membershipId}
```

예약 이메일 삭제를 별도로 지원하는 경우:

```http
DELETE /wards/{wardId}/admin-emails/{emailRegistrationId}
```

또는 기존 invitation 삭제 API를 유지할 수 있다.

```http
DELETE /wards/{wardId}/admin-invitations/{invitationId}
```

삭제 규칙:

- 요청자는 `OWNER`여야 한다.
- 대상이 `OWNER`이면 삭제 불가.
- `EDITOR` 활성 관리자 또는 예약 이메일만 삭제 가능하다.
- 삭제된 계정은 이후 해당 병동에 관리자 권한으로 입장할 수 없어야 한다.

## 에러 코드 권장

- `400 INVALID_EMAIL`: 이메일 형식 오류
- `403 OWNER_ONLY`: 오너가 아닌 계정이 추가/삭제 시도
- `404 WARD_NOT_FOUND`: 병동 없음
- `404 ADMIN_NOT_FOUND`: 삭제 대상 없음
- `409 ADMIN_ALREADY_EXISTS`: 같은 병동에 같은 이메일 또는 계정이 이미 등록됨
- `409 ADMIN_LIMIT_EXCEEDED`: 병동 관리자 최대 10명 초과
- `409 OWNER_CANNOT_BE_REMOVED`: 최고 관리자 삭제 시도

## 프론트 변경 영향

프론트는 이메일 하나만 보내는 형태로 변경될 예정이다.

현재 임시 호환을 위해 `admin-invitations` 호출 시 `invitedName`을 fallback으로 보낼 수 있지만, 최종적으로는 백엔드에서 `invitedName` required 검증을 제거해야 한다.
