# 근무표 작성/고정/AI 자동채우기 백엔드 전달 사항

작성일: 2026-07-08

## 결론

이번 프론트 변경만으로 MVP 동작은 가능하다. 다만 백엔드가 아래 계약을 만족하지 않으면 확정 단계 진입, 고정 셀 보존, AI 자동채우기 결과가 프론트 기대와 달라질 수 있다.

새 DB는 당장 필수는 아니다. 단, 서버 자동저장, 기기 간 이어쓰기, 다중 관리자 동시 편집까지 제품 범위에 넣는다면 draft 저장 DB가 필요하다.

## 백엔드 수정 또는 확인이 필요한 항목

### 1. workflow step을 5단계 체계로 맞추기

프론트는 더 이상 레거시 6단계를 호환하지 않는다.

현재 기준:

1. 근무자 확인
2. 제약조건
3. 신청 근무 확정
4. 근무표 작성하기
5. 확정 근무표

백엔드 저장/응답 기준:

- 작성 중: `workflowStatus = IN_PROGRESS`, `workflowStep = 1~4`
- 확정 완료: `workflowStatus = CONFIRMED`, `workflowStep = 5`
- `workflowStep = 6`은 더 이상 확정 단계로 보내지 않는다.

특히 `GET /schedule/workspace`, `GET /duty`, `PATCH /duty/workflow` 응답에서 `workflowStep`이 6으로 내려오지 않게 맞춰야 한다.

### 2. snapshot publish 시 서버 상태를 CONFIRMED/5로 저장하기

프론트 확정 플로우는 `publishSnapshot`을 호출한다.

현재 프론트 요청:

- `POST /schedule/snapshots/{snapshotId}/publish`
- body: `{ overwriteWardShift: true, applyRowOrder: true }`

프론트는 publish 성공 후 로컬 캐시를 `workflowStatus = CONFIRMED`, `workflowStep = 5`로 맞춘다. 서버도 publish 성공 시 실제 저장된 근무표 또는 workspace workflow를 동일하게 업데이트해야 한다.

필요 동작:

- publish 성공 시 해당 ward/shiftTeam/year/month의 workflow를 `CONFIRMED/5`로 저장
- 이후 `GET /duty`, `GET /schedule/workspace`에서 `CONFIRMED/5`가 조회되어야 함

### 3. AI 자동채우기에서 lockedCellKeys 절대 변경 금지

프론트는 AI 자동채우기 요청 시 보호 셀을 `lockedCellKeys`로 보낸다.

보호 대상:

- 신청근무 셀
- 사용자가 고정한 셀

키 형식:

- `lockedCellKeys`: `shiftNurseId:YYYY-MM-DD`
- 예: `12:2026-07-03`

백엔드/AI는 `lockedCellKeys`에 포함된 셀을 절대 변경하면 안 된다.

응답 조건:

- `changedCells`에 locked cell이 포함되지 않아야 함
- locked cell의 `wardShiftTypeId`, `shiftCode`, `fixed` 상태가 바뀌면 안 됨

### 4. snapshot cell의 fixed 값 왕복 보존

프론트는 사용자가 고정한 셀을 snapshot cell의 `fixed: true`로 저장한다.

관련 DTO:

```ts
type TSnapshotCellDTO = {
  cellKey?: string;
  shiftNurseId: number;
  nurseId?: number;
  date: string;
  wardShiftTypeId: number | null;
  shiftCode?: string;
  source?: string;
  fixed?: boolean;
};
```

필요 동작:

- `saveSnapshot` 요청의 `cells[].fixed`를 저장
- `getSnapshot`, `getSnapshots` 상세 조회, workspace latest snapshot 복원 시 `fixed`를 누락 없이 반환
- `publishSnapshot` 시 fixed 값 때문에 실제 근무 배정이 변하면 안 됨

주의:

- 신청근무는 프론트에서 `requestCells`로 보호한다.
- 사용자 고정은 `fixed: true`로 저장한다.
- 같은 셀이 신청근무이면서 fixed로 중복 저장되는 상황은 프론트에서 제거하지만, 서버도 중복이 들어와도 신청근무 우선으로 처리하는 것이 안전하다.

### 5. validation/autofill에서 fixed 셀을 보호 대상으로 일관 처리

validation은 fixed 셀도 일반 배정 셀로 검사할 수 있다. 다만 autofill/repair가 fixed 셀을 수정해서는 안 된다.

권장 기준:

- validation: fixed 여부와 무관하게 전체 근무표 제약 검사
- autofill generate/repair: `lockedCellKeys`와 `cells[].fixed = true`인 셀은 변경 금지
- repair 대상 violation에 fixed 셀이 포함되어 있어도, fixed 셀 자체를 바꾸지 않고 주변 비고정 셀로 해결 시도
- 해결 불가하면 `unmetInstructions` 또는 validation 결과로 알려줌

## 새 DB가 필요한 경우

아래 기능을 이번 범위에 넣는다면 별도 draft 저장 구조가 필요하다.

- 브라우저 localStorage가 사라져도 작성 중인 근무표 복구
- 다른 기기에서 작성 중 상태 이어쓰기
- 여러 관리자가 같은 근무표를 동시에 편집
- AI 실행 전후 draft 상태를 서버 기준으로 감사/추적

필요 최소 필드:

- wardId
- shiftTeamId
- year
- month
- cells
- rowOrder
- fixed 상태
- request 보호 상태 또는 request snapshot 참조
- workflowStatus
- workflowStep
- updatedAt

## 백엔드 체크리스트

- [ ] 확정 workflow step을 `5`로 저장/응답한다.
- [ ] `workflowStep = 6`을 더 이상 내려주지 않는다.
- [ ] `publishSnapshot` 성공 시 서버 상태가 `CONFIRMED/5`가 된다.
- [ ] `lockedCellKeys` 셀은 AI 결과에서 절대 변경되지 않는다.
- [ ] `changedCells`에 locked cell이 포함되지 않는다.
- [ ] snapshot 저장/조회에서 `cells[].fixed`가 왕복 보존된다.
- [ ] repair/autofill이 fixed 셀을 직접 수정하지 않는다.
