# 휴무 체크/쉬는 날 계산 백엔드 지원 요청

## 배경

병동마다 근무표에서 "쉬는 날"을 세는 기준이 조금씩 다릅니다.

이번 v1의 핵심은 단순히 "쉬어야 하는 일수" 숫자를 보여주는 것이 아니라, 근무표 작성 중 간호사별로 쉬는 날이 부족한지/초과했는지 바로 확인하는 것입니다.

프론트에서는 `/make` 캘린더에 `휴무 체크` 칼럼을 추가했습니다.

- `부족 2`: 기준보다 2일 덜 쉼
- `초과 1`: 기준보다 1일 더 쉼
- `맞음`: 기준과 실제 배정 쉬는 날이 같음

수간호사는 병동 설정에서 아래 기준만 간단히 정합니다.

- 이 병동에서 쉬는 날 계산 기능을 사용할지 말지
- 기본 쉬는 날 기준을 `주 단위 기준`으로 볼지, `월 고정 개수`로 볼지
- 공휴일이 있는 달에 기준 쉬는 날을 늘릴지 말지
- 어떤 근무유형을 실제 쉬는 날 개수에 포함할지
- 목표보다 못 쉰 날을 다음 달 근무표 기준에 반영하는 병동인지 아닌지

공휴일은 `includeHolidays`로 포함 여부만 저장합니다. 포함할 때 어떤 나라의 공휴일을 볼지는 현재 언어/서비스 지역 기준으로 계산합니다.

프론트에는 우선 localStorage 기반으로 아래 화면이 들어가 있습니다.

- 병동 설정 > 쉬는 날 계산 탭
- 근무표 만들기 > 근무자 확인 단계의 계산 기준 요약 카드

백엔드 API가 생기면 localStorage 저장을 API 저장으로 교체할 예정입니다.

## v1 요청 요약

병동 단위로 쉬는 날 계산 설정을 저장/조회할 수 있게 해주세요.

필수 범위:

1. 병동별 쉬는 날 계산 설정 조회
2. 병동별 쉬는 날 계산 설정 저장/수정
3. 쉬는 날 계산 기능 사용 여부 저장
4. 공휴일 포함 여부 저장
5. 언어/서비스 지역 기준의 공휴일 국가 결정
6. 월별/간호사별 이월 쉬는 날 저장/조회
7. 근무표 검증 응답에 간호사별 휴무 체크 요약 포함

후속 범위:

1. AI 자동 채우기에서 휴무 체크 기준 반영
2. 근무표 확정 시 다음 달 이월 제안값 자동 계산

## 설정 모델

```ts
type RestTargetMode = 'WEEKLY' | 'FIXED';
type HolidayCountry = 'KR' | 'JP' | 'US' | 'CN' | 'TH' | 'VN';

type RestLeavePolicy = {
  wardId: number;

  // 이 병동에서 쉬는 날 계산/휴무 체크 기능을 사용할지 여부
  // false이면 /make에서 휴무 체크, 이월, 부족/초과 표시를 숨깁니다.
  enabled: boolean;

  // 기본 쉬는 날 기준 계산 방식
  targetMode: RestTargetMode;

  // targetMode=WEEKLY일 때 사용
  // 예: 주당 쉬는 날 2개
  weeklyOffDays: number;

  // targetMode=FIXED일 때 사용
  // 예: 월 기본 쉬는 날 6개
  fixedMonthlyOffDays: number;

  // 공휴일이 있는 달에 기준 쉬는 날을 늘릴지 여부
  includeHolidays: boolean;

  // 실제 쉬는 날 개수에 포함할 근무유형 ID 목록
  // 프론트에는 isOff=true인 근무유형만 선택지로 노출합니다.
  // 예: OFF, 연차, 공가, 대체휴무 중 병동이 실제 쉬는 날로 세는 항목
  countedRestShiftTypeIds: number[] | null;

  // 목표보다 못 쉰 날을 다음 달 기준 쉬는 날에 반영하는 병동인지
  carryOverEnabled: boolean;

  // 저장값이 아니라 요청 언어/서비스 지역에서 파생해 응답에 내려주면 좋습니다.
  holidayCountry?: HolidayCountry;

  createdAt?: string;
  updatedAt?: string;
};
```

## 월별 보정값

`/make` 화면에서는 기본 설정을 바꾸지 않고, 해당 월 근무표에서만 쉬는 날 기준을 임시로 늘리거나 줄일 수 있게 했습니다.

프론트 v1은 localStorage에 저장합니다.

```ts
type MonthlyRestTargetAdjustment = {
  wardId: number;
  shiftTeamId: number;
  year: number;
  month: number;

  // 예: +1이면 이번 달 기준을 1일 늘림, -1이면 1일 줄임
  adjustmentDays: number;
};
```

후속으로 백엔드에 저장한다면 `wardId + shiftTeamId + year + month` 기준을 권장합니다.

```ts
monthlyTargetRestDays = baseTarget + holidayTarget + adjustmentDays;
```

## 기본값 제안

설정이 아직 저장되지 않은 병동은 아래 기본값으로 응답해 주세요.

```json
{
  "enabled": true,
  "targetMode": "WEEKLY",
  "weeklyOffDays": 2,
  "fixedMonthlyOffDays": 6,
  "includeHolidays": true,
  "countedRestShiftTypeIds": null,
  "carryOverEnabled": false
}
```

기본값은 기능 사용(`enabled=true`)과 공휴일 포함(`includeHolidays=true`)을 권장합니다. `countedRestShiftTypeIds=null`이면 프론트에서 `isOff=true`인 근무유형을 기본 선택값으로 보여줍니다. 빈 배열(`[]`)은 사용자가 아무 항목도 포함하지 않겠다고 저장한 값으로 취급합니다.

## 공휴일 국가 결정

프론트 기준 매핑:

```ts
ko -> KR
ja -> JP
en -> US
zh -> CN
th -> TH
vi -> VN
```

백엔드는 아래 중 하나를 권장합니다.

1. `X-Service-Region` 헤더가 있으면 우선 사용
2. 없으면 `Accept-Language` 또는 사용자 언어 설정으로 위 매핑 적용
3. 그래도 없으면 `US` 또는 서비스 기본 지역 사용

`holidayCountry`는 계산 기준 확인용으로 내려줄 수 있지만, 프론트 v1에서는 화면에 노출하지 않습니다.

## API 제안

### 쉬는 날 계산 설정 조회

```http
GET /wards/{wardId}/rest-leave-policy
Accept-Language: ko
```

응답:

```json
{
  "wardId": 421,
  "enabled": true,
  "targetMode": "WEEKLY",
  "weeklyOffDays": 2,
  "fixedMonthlyOffDays": 6,
  "includeHolidays": true,
  "countedRestShiftTypeIds": [10, 11, 12],
  "carryOverEnabled": false,
  "holidayCountry": "KR",
  "updatedAt": "2026-06-21T05:00:00Z"
}
```

### 쉬는 날 계산 설정 저장/수정

```http
PUT /wards/{wardId}/rest-leave-policy
Content-Type: application/json
Accept-Language: ko
```

요청:

```json
{
  "enabled": true,
  "targetMode": "WEEKLY",
  "weeklyOffDays": 2,
  "fixedMonthlyOffDays": 6,
  "includeHolidays": true,
  "countedRestShiftTypeIds": [10, 11, 12],
  "carryOverEnabled": false
}
```

응답:

```json
{
  "wardId": 421,
  "enabled": true,
  "targetMode": "WEEKLY",
  "weeklyOffDays": 2,
  "fixedMonthlyOffDays": 6,
  "includeHolidays": true,
  "countedRestShiftTypeIds": [10, 11, 12],
  "carryOverEnabled": false,
  "holidayCountry": "KR",
  "updatedAt": "2026-06-21T05:00:00Z"
}
```

## 검증 규칙

- `wardId`의 관리자 권한이 있는 계정만 조회/수정할 수 있어야 합니다.
- `weeklyOffDays`는 `1~7` 범위를 권장합니다.
- `fixedMonthlyOffDays`는 `0~31` 범위를 권장합니다.
- `targetMode=WEEKLY`여도 `fixedMonthlyOffDays`는 함께 저장해도 됩니다. 사용자가 모드를 바꿨을 때 이전 입력값을 유지하기 위함입니다.
- `targetMode=FIXED`여도 `weeklyOffDays`는 함께 저장해도 됩니다.
- `enabled`는 boolean만 허용합니다.
- `enabled=false`이면 다른 설정값은 유지하되, 계산/검증 응답에서는 휴무 체크를 생략하거나 `null`로 내려주세요.
- `includeHolidays`는 boolean만 허용합니다.
- `countedRestShiftTypeIds`는 해당 병동의 근무유형 ID만 허용합니다.
- `countedRestShiftTypeIds`에는 가능하면 `isOff=true`인 근무유형만 저장해 주세요.

## 계산 기준

### 월 기준 쉬는 날

`enabled=false`이면 쉬는 날 계산을 하지 않고, `monthlyTargetRestDays` 및 간호사별 `restCheck`는 내려주지 않아도 됩니다.

```ts
baseTarget =
  targetMode === 'WEEKLY'
    ? ceil(daysInMonth / 7) * weeklyOffDays
    : fixedMonthlyOffDays;

holidayTarget =
  includeHolidays
    ? countPublicHolidays(year, month, holidayCountry)
    : 0;

monthlyTargetRestDays = baseTarget + holidayTarget;
```

주의:

- 토요일/일요일은 주 단위 쉬는 날 기준에 이미 포함된 것으로 봅니다.
- `includeHolidays=true`일 때만 공휴일 수만큼 기준 쉬는 날을 늘립니다.
- 공휴일 국가는 언어/서비스 지역 기준으로 계산합니다.

### 간호사별 기준 쉬는 날

```ts
targetRestDays =
  monthlyTargetRestDays
  + (carryOverEnabled ? carriedOffDays : 0);
```

`carriedOffDays` 의미:

- `+2`: 이번 달에 2일 더 쉬어야 함
- `0`: 이월 없음
- `-1`: 지난달에 1일 더 쉬었으므로 이번 달 기준 쉬는 날을 1일 줄임

현재 프론트 도메인에는 `shiftNurse.carried` 필드가 이미 있고, 기존 API 클라이언트에도 아래 호출이 있습니다.

```http
PATCH /shift-nurses/{shiftNurseId}/carried
```

다만 이 값이 월별/근무표별 값인지 확인이 필요합니다. 현재 값이 월별 값이 아니라면, 아래처럼 `wardId + shiftTeamId + year + month + shiftNurseId` 기준 저장이 필요합니다.

```http
PATCH /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/carried-off?year={year}&month={month}
Content-Type: application/json

{
  "items": [
    {
      "shiftNurseId": 1001,
      "carriedOffDays": 2
    }
  ]
}
```

### 실제 배정 쉬는 날

```ts
assignedRestDays = count(schedule cells where wardShiftTypeId is in countedRestShiftTypeIds);
```

휴무 체크:

```ts
differenceDays = assignedRestDays - targetRestDays;
shortage = max(targetRestDays - assignedRestDays, 0);
surplus = max(assignedRestDays - targetRestDays, 0);
```

의미:

- `differenceDays < 0`: 부족
- `differenceDays > 0`: 초과
- `differenceDays = 0`: 맞음

## 근무표 검증 반영 요청

### 검증 응답 예시

`POST /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/validate-snapshot`에서 부족/초과 경고와 함께 간호사별 휴무 체크 요약을 내려주면 좋겠습니다.

```json
{
  "restChecks": [
    {
      "shiftNurseId": 1001,
      "nurseId": 501,
      "targetRestDays": 10,
      "assignedRestDays": 8,
      "carriedOffDays": 1,
      "differenceDays": -2,
      "shortageDays": 2,
      "surplusDays": 0
    }
  ],
  "violations": [
    {
      "ruleId": "REST_TARGET_SHORTAGE",
      "level": "warning",
      "shiftNurseId": 1001,
      "nurseId": 501,
      "message": "김OO님은 기준 쉬는 날 10일 중 8일만 배정되어 2일 부족해요.",
      "messageKey": "schedule.validation.restTargetShortage",
      "messageArgs": {
        "nurseName": "김OO",
        "target": 10,
        "actual": 8,
        "shortage": 2
      }
    }
  ]
}
```

v1에서는 부족하면 우선 `warning`으로 내려주는 것을 권장합니다. 확정 차단, 연차 자동 처리 같은 세부 운영 방식은 v1 범위에서 제외합니다.

### AI 생성 요청

AI 자동 채우기에서도 각 간호사의 `targetRestDays`를 고려해 주세요.

- `countedRestShiftTypeIds`에 포함된 근무유형만 실제 쉬는 날 개수에 포함
- `targetRestDays`보다 부족하지 않도록 배정
- `carryOverEnabled=true`이면 간호사별로 목표보다 못 쉰 날을 다음 달 기준 쉬는 날에 반영

## 프론트 반영 상태

현재 프론트는 아래 파일에 localStorage 기반 설정 모델과 UI가 들어가 있습니다.

- `apps/app/src/pages/ward-settings/model/rest-leave-policy.ts`
- `apps/app/src/pages/ward-settings/ui/rest-leave-policy-section.tsx`
- `apps/app/src/pages/make-shift/ui/steps/rest-leave-policy-summary-card.tsx`
- `apps/app/src/pages/make-shift/model/rest-target-days.ts`

백엔드 API가 생기면 아래 변경을 할 예정입니다.

- `useRestLeavePolicy(wardId)` 내부 저장소를 localStorage에서 API query/mutation으로 교체
- 병동 설정 > 쉬는 날 계산 설정 저장 시 `PUT /wards/{wardId}/rest-leave-policy` 호출
- 근무표 만들기 진입 시 `GET /wards/{wardId}/rest-leave-policy` 결과로 계산 기준 요약 표시
- 검증 응답의 `restChecks`를 `/make` 캘린더 `휴무 체크` 칼럼에 연결

## 완료 기준

v1 완료 기준:

1. 병동별 쉬는 날 계산 설정을 조회할 수 있습니다.
2. 병동별 쉬는 날 계산 설정을 저장/수정할 수 있습니다.
3. 저장된 설정이 다른 브라우저/다른 관리자 계정에서도 동일하게 보입니다.
4. 설정 미저장 병동은 기본 설정이 내려옵니다.
5. 응답에서 요청 언어/서비스 지역 기준 `holidayCountry`를 확인할 수 있습니다.
6. 월별/간호사별 이월 쉬는 날을 저장하고 조회할 수 있습니다.
7. 근무표 검증 응답에서 간호사별 기준/배정/이월/부족/초과를 확인할 수 있습니다.

후속 완료 기준:

1. AI 자동 채우기가 설정 기준 쉬는 날과 이월값을 고려합니다.
2. 근무표 확정 시 다음 달에 보탤 쉬는 날 제안값을 계산할 수 있습니다.

## 확인 필요

1. 쉬는 날 계산 설정 범위는 병동(`ward`) 단위로 충분한가요, 아니면 근무팀(`shiftTeam`)별 override가 필요할까요?
   - 프론트 v1은 병동 단위로 구현했습니다.
2. 기존 `shiftNurse.carried`가 월별/근무표별 값인지 확인이 필요합니다.
3. 영어 사용자의 공휴일 기준을 `US`로 볼지, 서비스 지역 헤더를 더 우선할지 결정이 필요합니다.
