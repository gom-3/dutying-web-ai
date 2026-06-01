# 근무자 관리 가능근무 저장 API 요청사항

## 배경

근무자 관리 화면에는 각 간호사별로 `가능근무`를 설정하는 기능이 있습니다.

병동 설정에서 정의한 근무유형은 해당 병동의 모든 간호사에게 표시되고, 각 간호사별로 on/off 선택이 가능해야 합니다.

예를 들어 병동 근무유형이 아래처럼 설정되어 있다면:

```text
D, E, N, O, A, W
```

근무자 관리에서는 모든 간호사에게 `D/E/N/O/A/W`가 전부 보여야 하고, 각 항목을 간호사별로 가능/불가능 처리할 수 있어야 합니다.

## 현재 문제

현재는 `D/E/N`은 저장되지만, 그 외 병동 근무유형은 저장 후 다시 원복됩니다.

프론트에서 확인한 원인은 다음과 같습니다.

- 병동에는 `wardShiftTypes`로 `D/E/N/O/A/W`가 존재합니다.
- 하지만 각 간호사의 `nurseShiftTypes`에는 `D/E/N`만 내려오는 경우가 있습니다.
- 현재 가능근무 수정 API는 `nurseShiftTypeId`를 path parameter로 요구합니다.
- `O/A/W`처럼 간호사별 `nurseShiftTypeId`가 없는 항목은 프론트에서 서버 저장을 할 수 없습니다.
- 프론트에서 병동 근무유형을 기준으로 임시 렌더링은 가능하지만, 저장 후 재조회하면 서버 응답에 없는 값이라 다시 원복됩니다.

## 현재 API

현재 Swagger 기준으로 확인되는 간호사별 근무유형 수정 API는 아래 1개입니다.

```http
PATCH /nurses/{nurseId}/shift-types/{nurseShiftTypeId}
```

Request body:

```json
{
  "isPossible": true,
  "isPreferred": true
}
```

이 API는 이미 존재하는 `nurseShiftTypeId`를 수정하는 구조입니다.

## 필요한 동작

병동 근무유형으로 설정된 모든 항목은 모든 간호사에게 가능근무 옵션으로 제공되어야 합니다.

예:

```json
{
  "wardShiftTypes": [
    {"wardShiftTypeId": 1, "shortName": "D"},
    {"wardShiftTypeId": 2, "shortName": "E"},
    {"wardShiftTypeId": 3, "shortName": "N"},
    {"wardShiftTypeId": 4, "shortName": "O"},
    {"wardShiftTypeId": 5, "shortName": "A"},
    {"wardShiftTypeId": 6, "shortName": "W"}
  ],
  "nurseShiftTypes": [
    {"nurseShiftTypeId": 101, "shortName": "D", "isPossible": true},
    {"nurseShiftTypeId": 102, "shortName": "E", "isPossible": true},
    {"nurseShiftTypeId": 103, "shortName": "N", "isPossible": true},
    {"nurseShiftTypeId": 104, "shortName": "O", "isPossible": true},
    {"nurseShiftTypeId": 105, "shortName": "A", "isPossible": true},
    {"nurseShiftTypeId": 106, "shortName": "W", "isPossible": true}
  ]
}
```

## 요청안 1: 응답 보완

가장 좋은 방식은 간호사 조회/근무팀 조회 응답에서 병동의 모든 근무유형에 대응되는 `nurseShiftTypes`를 항상 내려주는 것입니다.

대상 응답:

- `GET /wards/{wardId}/shift-teams`
- `GET /wards/{wardId}/shift-teams/{shiftTeamId}/nurses`
- `GET /nurses/{nurseId}`
- 기타 근무자 관리에서 사용하는 간호사 응답

요청사항:

- 병동에 설정된 모든 `wardShiftTypes`에 대해 각 간호사의 `nurseShiftTypes` row를 보장해주세요.
- 기존 간호사에게 새 병동 근무유형이 추가되었을 때도 해당 간호사들의 `nurseShiftTypes`가 생성되거나 응답에서 보완되어야 합니다.
- 기본 `isPossible` 값은 백엔드 정책에 따라 정해주세요. 현재 UX상으로는 새 근무유형은 기본 가능 상태인 `true`가 자연스럽습니다.

## 요청안 2: Upsert API 추가

응답에서 모든 `nurseShiftTypes` row를 보장하기 어렵다면, 프론트가 `wardShiftTypeId` 기준으로 가능근무를 생성/수정할 수 있는 upsert API가 필요합니다.

예시:

```http
PUT /nurses/{nurseId}/ward-shift-types/{wardShiftTypeId}
```

Request body:

```json
{
  "isPossible": false,
  "isPreferred": false
}
```

동작:

- 해당 간호사에게 해당 병동 근무유형의 `nurseShiftType` row가 있으면 수정
- 없으면 생성 후 수정
- 응답으로 생성/수정된 `nurseShiftTypeId`를 포함한 객체 반환

Response 예시:

```json
{
  "nurseShiftTypeId": 104,
  "name": "오프",
  "shortName": "O",
  "isPossible": false,
  "isPreferred": false
}
```

## 프론트 요구사항 기준

프론트에서는 다음 흐름으로 동작해야 합니다.

- 메인 근무자 목록에서 가능근무 클릭 시 즉시 서버에 저장됩니다.
- 오른쪽 상세 시트에서는 가능근무를 draft로 변경하고, `저장하기` 버튼을 눌렀을 때만 서버에 저장됩니다.
- 저장 후 재조회해도 선택 상태가 유지되어야 합니다.
- 병동 근무유형 설정에 있는 모든 근무유형이 각 간호사에게 표시되고 on/off 가능해야 합니다.

## 결론

현재 구조에서는 `nurseShiftTypeId`가 내려오는 `D/E/N`만 저장 가능하고, 간호사별 row가 없는 추가 병동 근무유형은 프론트에서 서버 저장할 방법이 없습니다.

따라서 아래 둘 중 하나가 필요합니다.

1. 모든 병동 근무유형에 대응되는 `nurseShiftTypes`를 간호사 응답에 항상 포함
2. `nurseId + wardShiftTypeId` 기준으로 생성/수정 가능한 upsert API 제공

