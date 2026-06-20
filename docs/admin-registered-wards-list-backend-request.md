# 관리자 이메일 등록 병동 목록 조회 백엔드 요청

## 배경

웹 `/enter-ward` 화면에는 두 가지 입장 경로가 필요합니다.

1. 병동 관리자에게 공유받은 6자리 병동 코드를 입력해서 입장
2. 현재 로그인한 계정 이메일이 이미 관리자로 등록된 병동을 목록에서 선택해서 입장

현재 프론트는 `GET /admin/accounts/me` 응답의 `memberships`를 기반으로 “내 이메일로 등록된 병동” 목록을 만들고 있습니다. 하지만 다른 병동에서 내 이메일을 관리자로 등록해도 해당 병동 정보가 `memberships` 또는 조회 가능한 목록으로 내려오지 않으면 프론트는 어떤 병동이 등록되어 있는지 알 수 없습니다.

## 현재 문제

오너가 특정 병동에서 관리자 이메일을 등록한 뒤에도 `/enter-ward`의 “내 이메일로 등록된 병동” 목록에 병동이 보이지 않는 경우가 있습니다.

프론트에서 확인 가능한 원인은 아래 중 하나입니다.

- `GET /admin/accounts/me` 응답에 해당 병동의 active `memberships`가 없음
- 이메일 등록 상태가 `reservedEmail`, invitation, pending 상태로만 존재하고 현재 계정 기준 조회 API에 노출되지 않음
- 병동 상세 조회를 위해 필요한 `wardId`, `hospitalName`, `wardName`, `code` 중 일부가 내려오지 않음

## 요청 사항

현재 로그인한 관리자 계정 이메일 기준으로, 이 계정이 입장할 수 있는 병동 목록을 조회할 수 있게 해주세요.

권장 방향은 둘 중 하나입니다.

## 옵션 A. `GET /admin/accounts/me`에 입장 가능 병동 목록 포함

`GET /admin/accounts/me` 응답에 현재 계정 이메일로 등록된 병동 목록을 내려주세요.

예시:

```json
{
  "accountId": 55,
  "email": "editor@example.com",
  "status": "WORKSPACE_SETUP_PENDING",
  "wardId": null,
  "memberships": [
    {
      "membershipId": 201,
      "wardId": 273,
      "role": "EDITOR",
      "status": "ACTIVE"
    }
  ],
  "registeredWards": [
    {
      "wardId": 273,
      "hospitalName": "듀팅병원",
      "wardName": "7A",
      "code": "A7K29Q",
      "role": "EDITOR",
      "status": "ACTIVE"
    }
  ]
}
```

프론트는 `registeredWards`가 있으면 바로 목록을 렌더링하고, 항목 클릭 시 해당 병동으로 입장 처리할 수 있습니다.

## 옵션 B. 별도 목록 API 추가

별도 API를 추가해도 됩니다.

```http
GET /admin/accounts/me/registered-wards
```

응답 예시:

```json
{
  "wards": [
    {
      "wardId": 273,
      "hospitalName": "듀팅병원",
      "wardName": "7A",
      "code": "A7K29Q",
      "role": "EDITOR",
      "status": "ACTIVE"
    }
  ]
}
```

## 포함되어야 하는 병동

아래 조건 중 하나를 만족하는 병동을 포함해 주세요.

- 현재 계정에 active `ward_admin_memberships`가 있는 병동
- 현재 계정 이메일과 동일한 이메일로 관리자 등록이 완료되어 있고, 로그인 계정과 연결 가능한 병동
- 기존 invitation 또는 reserved email 모델을 유지한다면, 현재 계정 이메일과 매칭되어 입장 가능한 상태의 병동

## 제외되어야 하는 병동

아래 상태는 목록에서 제외해 주세요.

- 삭제된 관리자 등록
- 만료되었거나 취소된 invitation
- 현재 계정 이메일과 매칭되지 않는 등록 정보
- 계정은 존재하지만 해당 병동 입장 권한이 없는 상태

## 프론트 입장 동작

프론트는 목록 항목 클릭 시 병동 입장을 시도합니다.

현재 프론트에는 병동 선택만으로 current ward를 변경하는 API가 없기 때문에, 아래 중 하나가 필요합니다.

### 방법 1. 기존 `join-by-code` 사용

목록 응답에 병동 `code`를 포함해 주세요.

프론트는 항목 클릭 시 아래 API를 호출합니다.

```http
POST /admin/wards/join-by-code
```

```json
{
  "code": "A7K29Q"
}
```

### 방법 2. 병동 ID 기반 입장 API 추가

코드를 응답에 내려주기 어렵다면 병동 ID 기반 API를 추가해 주세요.

```http
POST /admin/wards/{wardId}/enter
```

응답은 기존 `join-by-code`와 동일하게 현재 계정과 현재 병동 정보를 갱신할 수 있으면 됩니다.

## 기대 UX

1. 사용자가 `/enter-ward` 진입
2. 프론트가 현재 계정 이메일 기준 등록 병동 목록 조회
3. 등록된 병동이 있으면 “내 이메일로 등록된 병동” 섹션에 표시
4. 사용자가 병동 항목 클릭
5. 해당 병동으로 바로 입장

## 확인이 필요한 케이스

- 오너가 이미 가입된 계정 이메일을 등록한 경우 목록에 즉시 표시되는지
- 오너가 미가입 이메일을 등록한 뒤, 사용자가 그 이메일로 가입/로그인하면 목록에 표시되는지
- 다른 이메일로 로그인한 경우 목록에 표시되지 않는지
- 여러 병동에서 같은 이메일을 등록한 경우 여러 병동이 모두 표시되는지
- 기존 current ward가 있어도 다른 등록 병동이 목록에 함께 표시되는지

## 프론트 참고

현재 프론트는 임시로 아래 필드를 넓게 읽고 있습니다.

- `memberships`
- `adminMemberships`
- `wardAdminMemberships`

하지만 병동 이름과 코드까지 안정적으로 보여주려면 백엔드에서 등록 병동 목록을 명시적으로 내려주는 계약이 필요합니다.
