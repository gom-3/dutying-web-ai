# 전달근무(이월 근무) 제약조건 검증 반영 설계

작성일: 2026-07-18

## 구현 반영 (as-built, 2026-07-18)

아래 설계를 기준으로 서버·웹 모두 구현·검증 완료. 설계 대비 확정된 핵심 결정:

- **전용 필드로 분리.** 서버 `validateCellsInScope`가 이번 달 격자에 없는 날짜의 셀을 예외 처리하므로, 전달근무를 기존 `cells`에 섞지 않고 신규 optional 필드 `carryOverCells`로 보낸다. (`ValidationReq`, `AutofillReq`)
- **서버는 이미 `withPreviousMonthContext`로 직전 달을 DB에서 로드**하고 있었다. 여기에 `carryOverCells`를 **셀 단위 오버레이(FE 우선)**로 얹었다. FE 값이 없으면 기존 동작과 100% 동일(하위호환).
- **날짜는 웹이 계산.** `lastCells`는 시간순 오름차순(마지막 원소=직전 달 말일)이라, 직전 달 말일부터 역순으로 매핑한다. 왼쪽 패딩 null·빈칸·미지 코드는 미전송. `lastDays` 응답에 의존하지 않는다.
- **저장 무영향.** `carryOverCells`는 검증·프롬프트에만 쓰이고 스냅샷/확정에 저장되지 않는다. `saveSnapshot`은 미변경.
- **배포 순서: 서버 먼저.** 구서버는 Spring 기본 설정상 unknown 필드를 무시하므로 신웹이 먼저 떠도 안전하지만, 기능이 동작하려면 서버가 먼저 배포돼야 한다.

변경 파일:

- 서버: `ScheduleDto.java`(필드 추가), `ScheduleValidationInputBuilder.java`(6-arg 오버로드+오버레이), `ScheduleAuthoringService.java`(`normalizeCarryOverCells`, validate/autofill/priorMonthTail 배선), 테스트 `ScheduleValidationInputBuilderTest.java`
- 웹: `contracts.ts`(필드 추가), `shift-adapter.ts`(`docToCarryOverCellsDTO`), `schedule-authoring.ts`(validate/autofill 빌더 배선), 테스트 `shift-adapter.test.ts`

## 결론

근무표를 편집한 뒤 제약조건을 조회(`validate-snapshot`)할 때, 프론트가 **전달근무(직전 달 마지막 근무들)를 요청에 담지 않아** 서버가 월 경계 연속성 제약을 인식하지 못한다.

해결 방향은 두 가지다.

1. **프론트**: `validate-snapshot`(및 `autofill`) 요청 셀에 전달근무 셀(최대 `LAST_SHIFT_CONTEXT_COUNT = 4`개)을 직전 달 날짜로 함께 실어 보낸다.
2. **API 서버**: 직전 달 날짜의 셀을 읽기 전용 컨텍스트로 인식해 제약 계산에는 포함하되, 위반 표시/수정 대상에서는 제외한다.

전달근무는 화면에서 사용자가 직접 편집할 수 있으므로(빈칸 입력 유도 튜토리얼 포함), 서버 DB의 직전 달 값이 아니라 **프론트 draft 상태가 진실의 원천**이다. 따라서 프론트가 명시적으로 전송하는 것이 맞다.

## 배경 / 증상

- 근무표를 수정하고 제약조건을 조회하면, 월 경계에 걸친 연속 근무 등이 인식되지 않는다.
- 예: 직전 달 말일까지 `N N N`(나이트 3연속)인 근무자에게 이번 달 1일 `N`을 배정하면 나이트 4연속이지만, 서버는 이번 달 셀만 받으므로 나이트 1일로만 판단한다.
- 이미 `docs/backend-consecutive-work-violation-display-context-request.md`(120번째 줄)에서 "월 경계 이전 근무가 연속성 계산에 포함되는 경우"를 다루기로 했으나, 현재는 **그 이전 근무가 요청에 실려 있지 않아** 서버가 계산할 근거 자체가 없다.

## 원인 분석

제약조건 조회 요청 셀은 `docToSnapshotCellsDTO`가 만든다. 이 함수는 `doc.columns`(이번 달 날짜)만 순회하고 `row.cells`만 담는다. 전달근무가 담긴 `row.lastCells`는 전혀 포함되지 않는다.

`apps/app/src/features/shift-editor/model/shift-adapter.ts:264`

```ts
export function docToSnapshotCellsDTO(doc: TDutyDoc, originalShift: TShift): TSnapshotCellDTO[] {
    const maps = buildWardShiftTypeMaps(originalShift);
    const dto: TSnapshotCellDTO[] = [];

    for (const row of doc.rows) {
        const shiftNurseId = Number(row.workerId);
        const nurseId = doc.workerMeta[row.workerId]?.nurseId;

        for (let colIdx = 0; colIdx < doc.columns.length; colIdx += 1) {
            // ↑ doc.columns 는 이번 달 날짜만. row.lastCells(전달근무)는 순회 대상이 아님
            const date = doc.columns[colIdx]!;
            const cell = row.cells[colIdx] ?? null;
            ...
            dto.push({ cellKey, shiftNurseId, nurseId, date, wardShiftTypeId, shiftCode, source, fixed });
        }
    }

    return dto;
}
```

### 데이터 흐름

1. 편집 → `doc`(`TDutyDoc`) 변경
2. `useAsyncScheduleValidation` (debounce 1s) — `apps/app/src/features/shift-editor/model/use-async-schedule-validation.ts:22`
3. `refreshScheduleViolations` — `.../schedule-violations/refresh-schedule-violations.ts:23`
4. `buildValidateSnapshotDTO` — `apps/app/src/features/shift-editor/model/schedule-authoring.ts:33`
5. `docToSnapshotCellsDTO` ← **여기서 전달근무 누락**
6. `WardAPI.validateSnapshot` — `packages/api/src/ward/create-ward-api.ts:465`
   - `POST /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/validate-snapshot`

### 전달근무가 이미 draft에 존재함 (그러나 전송 안 됨)

- `TDutyRow.lastCells` — 전달근무 셀. `apps/app/src/features/shift-editor/model/types.ts:20`
- `LAST_SHIFT_CONTEXT_COUNT = 4` — `shift-adapter.ts:11`
- `normalizeLastShiftIds` — 항상 길이 4로 정규화, **왼쪽을 null 패딩**(오른쪽 끝이 가장 최근 날). `shift-adapter.ts:37`
- 전달근무는 음수 컬럼 인덱스로 **편집 가능**하다 (`readDutyCell`/`writeDutyCell`, `duty-doc-cells.ts:41`). 튜토리얼이 빈칸 입력을 유도한다(로케일 `previousShifts: '전달 근무'`, "전달근무에 빈칸이 있어요").
- 직전 달 날짜 정보는 `TShift.lastDays: TDay[]`에 있다 (`packages/domain/src/shift.ts:21`). 단, `lastCells`는 항상 4개, `lastDays` 길이는 응답에 따라 다를 수 있어 **정렬 규칙이 필요**하다(아래 참조).

## 목표 / 범위

- 제약조건 조회 시 전달근무 최대 4개를 서버가 인식해 월 경계 제약(연속 근무, 나이트 후 오프 등)을 정확히 계산한다.
- 전달근무 셀은 위반의 강한 하이라이트 대상이나 autofill/repair의 수정 대상이 되지 않는다(읽기 전용 컨텍스트).

범위 밖:
- 전달근무를 실제 근무표로 저장/확정하는 로직 변경(전달근무는 직전 달 소속이므로 이번 달 저장 대상 아님).
- 직전 달 근무표를 서버가 자동 병합하는 로직(대안 절 참조, 이번 범위는 프론트 명시 전송).

## 설계 — 프론트

### 1) 전달근무 셀 → DTO 변환 추가

`docToSnapshotCellsDTO`가 이번 달 셀에 이어 전달근무 셀을 추가로 append 하도록 확장한다. 날짜 키가 필요하므로 `year`/`month`(또는 직전 달 컬럼 목록)를 인자로 받는다.

권장 함수 시그니처(둘 중 택1):

- (A, 권장) `TDutyDoc`에 `lastColumns?: TDateKey[]`를 추가해 `shiftToDoc`에서 직전 달 날짜를 미리 채운다. 그러면 `docToSnapshotCellsDTO(doc, originalShift)` 시그니처를 유지한 채 `columns`와 동일한 방식으로 전달근무를 순회할 수 있다.
- (B, 경량) `docToSnapshotCellsDTO(doc, originalShift, {year, month})`로 년/월을 주입하고, `originalShift.lastDays`로부터 직전 달 날짜를 그때 계산한다.

두 경우 모두 `buildValidateSnapshotDTO`/`buildAutofillDTO`/`buildSaveSnapshotDTO`(`schedule-authoring.ts`)에서 동일 함수를 재사용한다. 단, **저장(`saveSnapshot`)에는 전달근무 셀을 넣지 않는다**(이번 달 스냅샷 오염 방지). 검증/autofill 요청에만 포함한다 — 아래 "다른 API 영향" 참조.

### 2) 전달근무 날짜 매핑 규칙

- 직전 달: `prevMonth = month === 1 ? 12 : month - 1`, `prevYear = month === 1 ? year - 1 : year`
- 직전 달 날짜 목록: `lastColumns = originalShift.lastDays.map(d => formatDateKey(prevYear, prevMonth, d.day))`
- `lastCells`(길이 4, 왼쪽 null 패딩)와 `lastColumns`를 **오른쪽 끝 기준으로 정렬**한다. `L = min(lastCells.length, lastColumns.length)`, offset `o = 0..L-1`에 대해
  - `date = lastColumns[lastColumns.length - 1 - o]`
  - `value = lastCells[lastCells.length - 1 - o]`
- `value`가 null/빈칸이면 **셀을 보내지 않는다**(빈 전달근무는 컨텍스트로 무의미).

> 확인 필요: `lastDays`의 길이가 항상 4인지, 혹은 4보다 많거나 적을 수 있는지. 다르면 위 오른쪽 정렬로 안전하게 매핑된다.

### 3) 셀 마킹

전달근무 셀은 아래로 표기한다.

- `source: 'CARRY_OVER'` — 기존 `resolveSnapshotCellSource`의 `FIXED|REQUEST|DRAFT|EMPTY`에 신규 값 추가
- `fixed: true` — autofill/repair가 절대 수정하지 못하도록 보호(기존 lockedCellKeys 규칙과 동일한 보호 효과)
- `cellKey: `${shiftNurseId}:${date}`` (직전 달 날짜)
- `wardShiftTypeId`는 `shortNameToType`로 변환, `shiftCode`는 shortName

## 설계 — API 서버 계약

대상 API:

- `POST /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/validate-snapshot`
- `POST /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/autofill` (요청 `cells`, 응답 `validation`)

요구 동작:

1. **인식**: 요청 `cells[]` 중 `date`가 요청 `year`/`month`보다 이전(직전 달)인 셀, 또는 `source === 'CARRY_OVER'`인 셀을 전달근무 컨텍스트로 인식한다. 둘 다 신호로 쓰되 `source`를 우선 기준으로 권장.
2. **검증 포함**: 전달근무 셀을 월 경계 연속성 계산에 포함한다(연속 근무 일수, 나이트 후 오프, 근무 간 최소 간격 등).
3. **불변 처리**: 전달근무 셀은 읽기 전용이다. autofill/repair가 값을 바꾸지 않으며 응답 `changedCells`에 포함하지 않는다.
4. **위반 표시 범위**: 위반의 강한 하이라이트(`affectedCells`)는 **이번 달 셀로만** 내려준다. 전체 연속 구간은 기존대로 `displayContext.affectedCells`로 내려주되, 전달근무(직전 달) 셀은 화면 표시가 불가하므로 포함 여부는 선택이다. `message`의 actual 값은 전달근무 포함 **전체 연속 일수** 기준으로 유지한다(기존 consecutive-work 문서 규칙과 동일).
5. **저장 영향 없음**: 검증/autofill이 받은 전달근무 셀은 이번 달 근무표 저장/확정에 반영되지 않는다.

## DTO 예시

이번 달 2026-07, 근무자 shiftNurseId=123. 직전 달(2026-06) 마지막 3일이 `N N N`, 이번 달 1일 `N`.

`validate-snapshot` 요청 `cells[]` 일부:

```json
[
  {"cellKey":"123:2026-06-28","shiftNurseId":123,"nurseId":45,"date":"2026-06-28","wardShiftTypeId":30,"shiftCode":"N","source":"CARRY_OVER","fixed":true},
  {"cellKey":"123:2026-06-29","shiftNurseId":123,"nurseId":45,"date":"2026-06-29","wardShiftTypeId":30,"shiftCode":"N","source":"CARRY_OVER","fixed":true},
  {"cellKey":"123:2026-06-30","shiftNurseId":123,"nurseId":45,"date":"2026-06-30","wardShiftTypeId":30,"shiftCode":"N","source":"CARRY_OVER","fixed":true},
  {"cellKey":"123:2026-07-01","shiftNurseId":123,"nurseId":45,"date":"2026-07-01","wardShiftTypeId":30,"shiftCode":"N","source":"DRAFT","fixed":false}
]
```

기대 위반(나이트 최대 3연속 가정): actual=4로 판정, 강한 하이라이트는 `2026-07-01`만.

## 엣지 케이스

- **빈 전달근무**: `lastCells` 값이 null이면 해당 셀 미전송.
- **직전 달 미확정/데이터 없음**: `lastDays`가 비었으면 전달근무 셀 0개(기존 동작과 동일).
- **연/월 경계(1월)**: `prevYear` 롤오버 처리.
- **`lastDays` 길이 ≠ 4**: 오른쪽 정렬로 안전 매핑, 초과분은 무시.
- **전달근무를 사용자가 수정**: 편집된 `lastCells` 값이 그대로 전송되어야 함(서버 DB 직전 달 값과 다를 수 있음 → 프론트 값 우선).
- **autofill locked**: 전달근무 셀은 `fixed:true`이므로 기존 lockedCell 보호 규칙에 자연히 편입.

## 다른 API 영향 (결정 필요)

`docToSnapshotCellsDTO`는 세 곳에서 공유된다.

| 빌더 | 전달근무 포함? | 이유 |
| --- | --- | --- |
| `buildValidateSnapshotDTO` | 포함 | 제약 검증에 필요 |
| `buildAutofillDTO` | 포함(fixed 보호) | 월 경계 제약 준수하며 생성 |
| `buildSaveSnapshotDTO` | **미포함 권장** | 이번 달 스냅샷/확정 오염 방지 |

→ 공유 함수에 "전달근무 포함" 옵션 플래그를 두거나, 전달근무 전용 함수(`docToCarryOverCellsDTO`)를 만들어 검증/autofill 빌더에서만 concat 하는 방식을 권장.

## 대안: 서버가 직전 달을 DB에서 조회

서버가 직전 달 확정 근무표를 직접 조회해 병합할 수도 있다. 그러나 전달근무는 프론트에서 **사용자가 직접 편집/입력**할 수 있어(빈칸 채우기 튜토리얼) DB 값과 어긋날 수 있다. draft 진실의 원천이 프론트이므로 **프론트 명시 전송**을 채택한다. 서버 조회는 프론트가 값을 안 보낸 셀에 대한 폴백으로만 고려.

## 체크리스트

프론트:
- [ ] `TDutyDoc`에 `lastColumns` 추가 또는 빌더에 `year/month` 주입
- [ ] 전달근무 셀 변환(오른쪽 정렬, null 제외, `source:'CARRY_OVER'`, `fixed:true`)
- [ ] `validate-snapshot`/`autofill`에만 포함, `saveSnapshot` 제외
- [ ] 연/월 경계·`lastDays` 길이 불일치 테스트

API 서버:
- [ ] 직전 달/`source:'CARRY_OVER'` 셀을 컨텍스트로 인식
- [ ] 월 경계 연속성 등 제약 계산에 포함
- [ ] autofill/repair가 전달근무 셀 미수정, `changedCells` 미포함
- [ ] 강한 위반 하이라이트는 이번 달 셀로 한정, `message` actual은 전체 기준
- [ ] 검증/autofill의 전달근무 셀이 저장/확정에 반영되지 않음

## 미해결 질문

- `TShift.lastDays` 길이는 항상 4인가? 서버가 내려주는 직전 달 컨텍스트 일수 기준은?
- autofill 생성 시 전달근무를 고려하도록 이미 되어 있는가, 아니면 이번에 함께 반영해야 하는가?
- 위반 `displayContext.affectedCells`에 직전 달 셀을 포함할지(화면 표시 불가) — 포함/제외 정책 확정 필요.
