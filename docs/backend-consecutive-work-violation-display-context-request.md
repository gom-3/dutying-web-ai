# 연속 근무 초과 위반 표시 범위 개선 요청

## 배경

현재 `최대 5일 연속 근무` 조건에서 한 근무자가 10일 연속 근무하는 경우, 캘린더에는 앞쪽 5일만 위반처럼 표시되는 케이스가 있습니다.

예:

```text
DDDDDDDDDD
```

이 경우 앞 5일은 허용 범위 안에 있고, 실제 문제는 10일짜리 연속 근무 구간이 제한을 초과했다는 점입니다. 따라서 앞 5일만 강한 위반으로 보이면 사용자가 수정해야 할 위치를 반대로 이해할 수 있습니다.

## 요청 방향

연속 근무 초과 위반은 아래처럼 표시할 수 있도록 validation 응답을 조정해 주세요.

1. 전체 연속 근무 구간은 약한 context 하이라이트로 표시
2. 제한을 초과한 구간만 강한 위반 하이라이트로 표시

예: 최대 5일 허용, 실제 10일 연속 근무

```text
1  2  3  4  5  6  7  8  9  10
D  D  D  D  D  D  D  D  D  D
------------------------------  weak context
               ---------------  strong violation
```

## 대상 API

- `POST /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/validate-snapshot`
- `POST /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/autofill` 응답의 `validation`

## 응답 계약 제안

기존 `violations[].affectedCells`는 강하게 표시할 실제 위반/초과 셀로 사용합니다.

새 optional 필드 `violations[].displayContext`를 추가해, 약하게 표시할 전체 맥락 셀을 내려주세요.

```ts
type ScheduleViolationDisplayContext = {
  period?: {
    startDate?: string;
    endDate?: string;
    dates?: string[];
  } | null;
  affectedCells: AffectedCell[];
};

type ScheduleViolation = {
  violationId: string;
  ruleId: number;
  templateCode: string;
  severity: "HARD" | "SOFT";
  message: string;
  period?: {
    startDate?: string;
    endDate?: string;
    dates?: string[];
  } | null;
  affectedCells: AffectedCell[];
  displayContext?: ScheduleViolationDisplayContext | null;
  fixable: boolean;
};
```

## 예시

최대 5일 허용, 2026-07-01부터 2026-07-10까지 10일 연속 근무한 경우:

```json
{
  "violationId": "CORE_MAX_CONTINUOUS_WORK:123:2026-07-01:2026-07-10",
  "ruleId": 1592,
  "templateCode": "CORE_MAX_CONTINUOUS_WORK",
  "severity": "HARD",
  "message": "김민정님은 근무가 10일 연속이에요. 최대 5일까지 가능해요.",
  "period": {
    "startDate": "2026-07-06",
    "endDate": "2026-07-10"
  },
  "affectedCells": [
    {"cellKey": "123:2026-07-06", "shiftNurseId": 123, "date": "2026-07-06", "wardShiftTypeId": 10, "shiftCode": "D"},
    {"cellKey": "123:2026-07-07", "shiftNurseId": 123, "date": "2026-07-07", "wardShiftTypeId": 10, "shiftCode": "D"},
    {"cellKey": "123:2026-07-08", "shiftNurseId": 123, "date": "2026-07-08", "wardShiftTypeId": 10, "shiftCode": "D"},
    {"cellKey": "123:2026-07-09", "shiftNurseId": 123, "date": "2026-07-09", "wardShiftTypeId": 10, "shiftCode": "D"},
    {"cellKey": "123:2026-07-10", "shiftNurseId": 123, "date": "2026-07-10", "wardShiftTypeId": 10, "shiftCode": "D"}
  ],
  "displayContext": {
    "period": {
      "startDate": "2026-07-01",
      "endDate": "2026-07-10"
    },
    "affectedCells": [
      {"cellKey": "123:2026-07-01", "shiftNurseId": 123, "date": "2026-07-01", "wardShiftTypeId": 10, "shiftCode": "D"},
      {"cellKey": "123:2026-07-02", "shiftNurseId": 123, "date": "2026-07-02", "wardShiftTypeId": 10, "shiftCode": "D"},
      {"cellKey": "123:2026-07-03", "shiftNurseId": 123, "date": "2026-07-03", "wardShiftTypeId": 10, "shiftCode": "D"},
      {"cellKey": "123:2026-07-04", "shiftNurseId": 123, "date": "2026-07-04", "wardShiftTypeId": 10, "shiftCode": "D"},
      {"cellKey": "123:2026-07-05", "shiftNurseId": 123, "date": "2026-07-05", "wardShiftTypeId": 10, "shiftCode": "D"},
      {"cellKey": "123:2026-07-06", "shiftNurseId": 123, "date": "2026-07-06", "wardShiftTypeId": 10, "shiftCode": "D"},
      {"cellKey": "123:2026-07-07", "shiftNurseId": 123, "date": "2026-07-07", "wardShiftTypeId": 10, "shiftCode": "D"},
      {"cellKey": "123:2026-07-08", "shiftNurseId": 123, "date": "2026-07-08", "wardShiftTypeId": 10, "shiftCode": "D"},
      {"cellKey": "123:2026-07-09", "shiftNurseId": 123, "date": "2026-07-09", "wardShiftTypeId": 10, "shiftCode": "D"},
      {"cellKey": "123:2026-07-10", "shiftNurseId": 123, "date": "2026-07-10", "wardShiftTypeId": 10, "shiftCode": "D"}
    ]
  },
  "fixable": true
}
```

## 판정 규칙

- `actual <= limit`이면 위반을 내려주지 않습니다.
- `actual > limit`이면 하나의 연속 구간마다 violation 1개를 내려줍니다.
- `affectedCells`는 `limit + 1`번째 날부터 연속 구간 마지막 날까지 내려줍니다.
- `displayContext.affectedCells`는 해당 연속 구간 전체를 내려줍니다.
- 휴무 또는 근무로 카운트하지 않는 shift type이 중간에 있으면 연속 구간을 끊어 주세요.
- 월 경계 이전 근무가 연속성 계산에 포함되는 경우, 화면에 표시 가능한 현재 월 셀은 동일한 규칙으로 내려주고 `message`의 actual은 전체 연속 일수를 기준으로 유지해 주세요.

## 프론트 반영 상태

프론트는 `displayContext`가 있으면 해당 셀들을 약한 context span으로 먼저 그리고, 기존 `affectedCells`는 강한 위반 span으로 그리도록 준비되어 있습니다.

`displayContext`가 없으면 기존처럼 `affectedCells`만 표시하므로, 백엔드 배포 전에도 호환됩니다.
