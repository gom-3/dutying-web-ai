# 근무표 만들기 진행 상태 백엔드 요청

## 배경

웹 홈과 `/make`는 간호 팀별 다음 달 근무표 상태를 `작성 전`, `진행 중`, `확정`으로 보여줘야 합니다.

현재 프론트는 근무표 칸 데이터만 받을 수 있어서 아래 상태를 정확히 구분하기 어렵습니다.

- 근무표 만들기 플로우에 한 번도 들어가지 않음
- 플로우에는 들어갔지만 아직 확정하지 않음
- 근무표 만들기에서 확정함

이 상태는 근무 칸이 채워졌는지와 다른 개념이므로, 팀+월 기준의 워크플로우 상태를 백엔드가 저장하고 내려줘야 합니다.

## 요청 계약

`GET /wards/{wardId}/shift-teams/{shiftTeamId}/duty?year={year}&month={month}` 응답에 아래 필드를 추가해 주세요.

```ts
type ShiftWorkflowStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'CONFIRMED';

type ShiftResponse = {
  // existing fields
  lastDays: Day[];
  days: Day[];
  wardShiftTypes: WardShiftType[];
  divisionShiftNurses: Row[][];

  // new fields
  workflowStatus: ShiftWorkflowStatus;
  workflowStep?: 1 | 2 | 3 | 4 | 5 | 6 | null;
};
```

## 상태 정의

`NOT_STARTED`

- 해당 `wardId + shiftTeamId + year + month` 조합으로 근무표 만들기 플로우에 한 번도 들어가지 않은 상태입니다.
- 홈에서는 `작성 전`으로 표시합니다.

`IN_PROGRESS`

- 근무표 만들기 플로우에 한 번이라도 들어간 상태입니다.
- 아직 확정하지 않았거나, 확정된 근무표를 다시 수정하기 시작한 상태입니다.
- 홈에서는 `진행 중`으로 표시합니다.
- `workflowStep`을 내려줄 수 있으면 마지막 진행 단계 또는 최대 도달 단계를 내려주세요. 단, `IN_PROGRESS`에서는 `1~5`를 권장합니다.

`CONFIRMED`

- 근무표 만들기에서 확정한 상태입니다.
- 홈에서는 `확정`으로 표시합니다.
- `/make`에서는 확정 근무표 화면으로 진입합니다.
- `workflowStep`은 `6`을 내려주세요.

## 상태 변경 시점

백엔드에서 아래 시점에 상태를 업데이트해 주세요.

- 근무표 만들기 플로우 최초 진입: `IN_PROGRESS`
- 플로우 단계 이동 또는 저장: `IN_PROGRESS`, `workflowStep` 갱신
- 근무표 확정 성공: `CONFIRMED`, `workflowStep = 6`
- 확정 근무표 수정 시작: `IN_PROGRESS`, `workflowStep = 5`

프론트에서 상태 변경 API를 호출해야 한다면 아래 형태를 권장합니다.

```http
PATCH /wards/{wardId}/shift-teams/{shiftTeamId}/duty/workflow?year={year}&month={month}
Content-Type: application/json

{
  "workflowStatus": "IN_PROGRESS",
  "workflowStep": 3
}
```

다만 확정은 기존 snapshot publish 또는 근무표 확정 API가 성공하는 시점에 백엔드에서 자동으로 `CONFIRMED` 처리해도 됩니다.

## 프론트 반영 상태

프론트는 이미 `workflowStatus`와 `workflowStep`을 optional 필드로 읽도록 준비되어 있습니다.

- `workflowStatus`가 있으면 홈과 `/make` 모두 이 값을 최우선으로 사용합니다.
- 필드가 없으면 홈은 기존 근무표 칸 데이터를 fallback으로 사용하고, `/make`는 기존 로컬 진행 저장값도 함께 fallback으로 사용합니다.
- 백엔드 구현 후에는 홈의 다음 달 근무표 배지가 `작성 전 / 진행 중 / 확정` 기준으로 정확히 동작합니다.

## 완료 기준

- 홈의 다음 달 근무표 섹션에서 팀별 상태가 정확히 표시됩니다.
- `/make` 진입 시 `CONFIRMED` 상태면 확정 화면으로 열립니다.
- `/make` 진입 시 `IN_PROGRESS` 상태면 이어서 만들 수 있는 상태로 열립니다.
- 다른 브라우저나 다른 관리자 계정에서도 같은 팀+월 상태가 동일하게 보입니다.
