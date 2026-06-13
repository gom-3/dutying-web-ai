# 근무팀 제약조건 저장 API 관리자 계정 403 백엔드 요청

작성일: 2026-06-11

## 요약

관리자 웹의 `/make` 제약조건 단계에서 제약조건을 수정하면 아래 저장 API가 403을 반환합니다.

```http
PUT https://dev.api.dutying.net/wards/370/shift-teams/640/shift-constraint-rules
```

응답:

```json
{
  "code": "WARD_ADMIN_ACCOUNT_API_REQUIRED",
  "message": "관리자 계정은 관리자 계정 API를 사용해야 합니다.",
  "messageKey": "error.wardAdminAccountApiRequired",
  "displayPolicy": "CLIENT_TRANSLATE",
  "locale": "ko-KR",
  "requestId": "5aebd276"
}
```

현재 화면은 관리자 계정이 사용하는 웹 관리자 플로우입니다. 제약조건 설정은 병동 관리자 기능이므로, 해당 병동의 ACTIVE 관리자 membership이 있는 계정에서는 저장이 성공해야 합니다.

## 재현 정보

1. dev 환경에서 관리자 계정으로 로그인
2. `/make` 진입
3. 근무팀 `shiftTeamId=640`, 병동 `wardId=370`의 제약조건 수정
4. 프론트가 아래 API 호출
5. 서버가 403 반환

```http
PUT /wards/370/shift-teams/640/shift-constraint-rules
```

브라우저 콘솔 stack:

```text
create-ward-api.ts:217
shift-constraint-rules.ts:57
constraints.tsx:2130
```

관련 프론트 코드:

```text
packages/api/src/ward/create-ward-api.ts
apps/app/src/pages/make-shift/model/shift-constraint-rules.ts
apps/app/src/pages/make-shift/ui/steps/constraints.tsx
```

## 현재 프론트 API 계약

제약조건 후보 조회:

```http
GET /wards/{wardId}/shift-teams/{shiftTeamId}/shift-constraint-rules/candidates
```

제약조건 목록 조회:

```http
GET /wards/{wardId}/shift-teams/{shiftTeamId}/shift-constraint-rules
```

제약조건 저장:

```http
PUT /wards/{wardId}/shift-teams/{shiftTeamId}/shift-constraint-rules
```

저장 요청 payload:

```json
{
  "rules": [
    {
      "shiftConstraintRuleId": 123,
      "templateCode": "SOFT_NO_N_TO_D",
      "severity": "SOFT",
      "sortOrder": 1,
      "params": {
        "target": 1
      },
      "selected": true,
      "isImportant": false
    }
  ]
}
```

신규 규칙은 `shiftConstraintRuleId` 없이 전송될 수 있습니다. 권장 기본 조건을 사용자가 숨긴 경우 `selected: false`로 저장될 수 있습니다.

기대 응답:

```json
{
  "schemaVersion": 1,
  "wardId": 370,
  "shiftTeamId": 640,
  "rules": [
    {
      "shiftConstraintRuleId": 123,
      "templateCode": "SOFT_NO_N_TO_D",
      "category": "FORBIDDEN",
      "severity": "SOFT",
      "sortOrder": 1,
      "params": {
        "target": 1
      },
      "selected": true,
      "isImportant": false,
      "displayText": "N 다음날 D 근무를 피해요",
      "isValid": true,
      "invalidReason": null
    }
  ]
}
```

## 문제로 보이는 지점

서버 응답 코드상 현재 백엔드는 관리자 계정 토큰으로 일반 `/wards/{wardId}` 계열 API를 호출하는 것을 차단하고 있습니다.

다만 관리자 웹의 병동 운영 화면은 현재 병동 데이터 조회/수정에 `/wards/{wardId}` 계열 API를 사용하고 있고, 제약조건 설정도 병동 관리자 기능입니다. 특히 같은 리소스의 조회 API와 저장 API가 같은 정책으로 동작해야 합니다.

## 백엔드 확인 요청

아래 항목 확인 부탁드립니다.

1. 로그인한 관리자 계정이 `wardId=370`에 대해 ACTIVE 관리자 membership을 가지고 있는지
2. `shiftTeamId=640`이 `wardId=370`에 속한 근무팀인지
3. 관리자 계정에서 아래 API 호출을 허용하는 정책이 맞는지

```http
GET /wards/{wardId}/shift-teams/{shiftTeamId}/shift-constraint-rules/candidates
GET /wards/{wardId}/shift-teams/{shiftTeamId}/shift-constraint-rules
PUT /wards/{wardId}/shift-teams/{shiftTeamId}/shift-constraint-rules
```

4. 허용 정책이라면 `PUT /wards/{wardId}/shift-teams/{shiftTeamId}/shift-constraint-rules`에도 관리자 membership 권한 체크를 적용해 주세요.
5. 허용하지 않는 정책이라면 관리자 전용 대체 API 경로를 공유 부탁드립니다.

예:

```http
PUT /admin/wards/{wardId}/shift-teams/{shiftTeamId}/shift-constraint-rules
```

이 경우 프론트에서 관리자 계정 여부에 따라 저장 API 경로를 분기하겠습니다. 단, 조회/후보/저장 API 전체의 관리자 전용 경로와 응답 스키마가 함께 필요합니다.

## 권장 해결 방향

프론트 변경 범위를 줄이려면 기존 `/wards/{wardId}` 계열 API를 관리자 계정에도 허용하는 방향을 권장합니다.

권한 판단 예시:

```text
principalType = WARD_ADMIN
AND ward_admin_memberships.account_id = current admin account
AND ward_admin_memberships.ward_id = requested wardId
AND ward_admin_memberships.status = ACTIVE
AND shift_team.ward_id = requested wardId
```

이 조건을 만족하면 아래 API가 403 없이 동작해야 합니다.

```http
PUT /wards/{wardId}/shift-teams/{shiftTeamId}/shift-constraint-rules
```

권한이 없거나 근무팀이 해당 병동에 속하지 않는 경우에만 `403 ACCESS_DENIED` 또는 `404 NOT_FOUND`를 반환하면 됩니다.

## 기대 동작

관리자 계정이 해당 병동의 ACTIVE 관리자라면:

1. `/make`에서 제약조건 추가/삭제/중요 표시 변경이 403 없이 저장됩니다.
2. `근무설정 > 제약조건`에서도 같은 규칙이 조회됩니다.
3. 다른 브라우저/새로고침 후에도 저장된 제약조건이 유지됩니다.
4. 권한이 없는 병동 또는 다른 병동의 근무팀에 대해서만 명확한 403/404가 발생합니다.

## 프론트 임시 대응 가능 범위

프론트에서는 저장 실패 시 토스트로 안내하고 이전 캐시로 롤백할 수 있습니다. 하지만 현재 문제는 정상 관리자 계정의 저장 API가 서버 권한 정책에서 차단되는 것이므로, 근본 해결은 백엔드 권한 허용 또는 관리자 전용 API 계약 제공이 필요합니다.
