# 쉬는 날 계산 설정 백엔드 API 요청

## 배경

`https://dev.dutying.net/ward-settings?tab=restLeavePolicy` 화면에는 병동별로 "쉬는 날 계산" 기준을 설정하는 UI가 들어가 있습니다.

현재 프론트엔드는 아래 값을 `localStorage`에만 저장하고 있어, 다른 브라우저/다른 관리자 계정에서는 설정이 공유되지 않습니다. 백엔드에 병동 단위 설정 조회/저장 API가 필요합니다.

이 설정은 `/make` 근무표 작성 화면의 휴무 체크 칼럼과 목표 쉬는 날 계산에도 사용됩니다.

## 현재 프론트 동작

- 위치: 병동 설정 > 쉬는 날 계산 탭
- URL: `/ward-settings?tab=restLeavePolicy`
- 저장 방식: `localStorage`
- 저장 키: `dutying:ward:{wardId}:rest-leave-policy`
- 관련 코드:
  - `apps/app/src/pages/ward-settings/model/rest-leave-policy.ts`
  - `apps/app/src/pages/ward-settings/ui/rest-leave-policy-section.tsx`
  - `apps/app/src/pages/make-shift/ui/steps/rest-leave-policy-summary-card.tsx`
  - `apps/app/src/pages/make-shift/model/rest-target-days.ts`

백엔드 API가 생기면 `useRestLeavePolicy(wardId)`의 저장소를 `localStorage`에서 API query/mutation으로 교체할 예정입니다.

## 설정 모델

```ts
type RestTargetMode = 'weekly' | 'fixed';
type LeaveCountMode = 'allLeaves' | 'offOnly';
type HolidayCountry = 'KR' | 'JP' | 'US' | 'CN' | 'TH' | 'VN';

type RestLeavePolicy = {
    wardId: number;

    // false이면 /make에서 휴무 체크와 목표 쉬는 날 표시를 숨깁니다.
    enabled: boolean;

    // weekly: 주 단위 기준, fixed: 월 고정 기준
    targetMode: RestTargetMode;

    // targetMode=weekly일 때 사용하는 주당 쉬는 날 수
    weeklyOffDays: number;

    // targetMode=fixed일 때 사용하는 월 고정 쉬는 날 수
    fixedMonthlyOffDays: number;

    // 공휴일 수만큼 목표 쉬는 날을 늘릴지 여부
    includeHolidays: boolean;

    // 실제 쉬는 날로 카운트할 병동 근무유형 ID 목록
    // null이면 leaveCountMode 기준으로 기본값을 적용합니다.
    countedRestShiftTypeIds: number[] | null;

    // 레거시/기본 선택 정책
    // allLeaves: isOff=true인 모든 휴무/휴가 유형 포함
    // offOnly: isOff=true && classification='OFF' 유형만 포함
    leaveCountMode: LeaveCountMode;

    // 간호사별 이월 값을 목표 쉬는 날에 반영할지 여부
    carryOverEnabled: boolean;

    // 조회 응답에서 계산 기준 확인용으로 내려주면 좋습니다.
    holidayCountry?: HolidayCountry;

    createdAt?: string;
    updatedAt?: string;
};
```

## 기본값

설정이 아직 저장되지 않은 병동은 아래 기본값으로 응답해주세요.

```json
{
    "enabled": true,
    "targetMode": "weekly",
    "weeklyOffDays": 2,
    "fixedMonthlyOffDays": 6,
    "includeHolidays": true,
    "countedRestShiftTypeIds": null,
    "leaveCountMode": "allLeaves",
    "carryOverEnabled": false
}
```

`countedRestShiftTypeIds=null`은 프론트가 기본 포함 대상을 계산하겠다는 의미입니다. 빈 배열 `[]`은 사용자가 아무 근무유형도 쉬는 날로 세지 않겠다고 저장한 명시값으로 구분해주세요.

## API

### 쉬는 날 계산 설정 조회

```http
GET /wards/{wardId}/rest-leave-policy
Accept-Language: ko
Authorization: Bearer {adminToken}
```

#### Response 200

```json
{
    "wardId": 421,
    "enabled": true,
    "targetMode": "weekly",
    "weeklyOffDays": 2,
    "fixedMonthlyOffDays": 6,
    "includeHolidays": true,
    "countedRestShiftTypeIds": [10, 11, 12],
    "leaveCountMode": "allLeaves",
    "carryOverEnabled": false,
    "holidayCountry": "KR",
    "createdAt": "2026-06-23T09:00:00Z",
    "updatedAt": "2026-06-23T09:10:00Z"
}
```

설정이 없을 때도 `404`가 아니라 기본값을 채운 `200` 응답을 반환해주세요.

### 쉬는 날 계산 설정 저장

```http
PUT /wards/{wardId}/rest-leave-policy
Content-Type: application/json
Accept-Language: ko
Authorization: Bearer {adminToken}
```

같은 `wardId` 설정이 있으면 수정하고, 없으면 생성하는 upsert 방식으로 처리해주세요.

#### Request Body

```json
{
    "enabled": true,
    "targetMode": "weekly",
    "weeklyOffDays": 2,
    "fixedMonthlyOffDays": 6,
    "includeHolidays": true,
    "countedRestShiftTypeIds": [10, 11, 12],
    "leaveCountMode": "allLeaves",
    "carryOverEnabled": false
}
```

#### Response 200

```json
{
    "wardId": 421,
    "enabled": true,
    "targetMode": "weekly",
    "weeklyOffDays": 2,
    "fixedMonthlyOffDays": 6,
    "includeHolidays": true,
    "countedRestShiftTypeIds": [10, 11, 12],
    "leaveCountMode": "allLeaves",
    "carryOverEnabled": false,
    "holidayCountry": "KR",
    "createdAt": "2026-06-23T09:00:00Z",
    "updatedAt": "2026-06-23T09:10:00Z"
}
```

## 권한

- 병동 관리자 인증 토큰이 필요합니다.
- 요청한 `wardId`에 대해 현재 관리자 계정이 활성 관리자 멤버십을 가지고 있어야 합니다.
- 권한이 없으면 `403 Forbidden`을 반환해주세요.
- 인증이 없거나 만료된 경우 기존 관리자 API 규칙과 동일하게 `401 Unauthorized`를 반환해주세요.

## 검증 규칙

- `wardId`: 양의 정수
- `enabled`: boolean
- `targetMode`: `weekly` 또는 `fixed`
- `weeklyOffDays`: 1 이상 7 이하 정수
- `fixedMonthlyOffDays`: 0 이상 31 이하 정수
- `includeHolidays`: boolean
- `countedRestShiftTypeIds`: `null` 또는 양의 정수 배열
- `countedRestShiftTypeIds`에 값이 있으면 해당 `wardId`에 속한 근무유형 ID만 허용
- 가능하면 `countedRestShiftTypeIds`에는 `isOff=true`인 근무유형만 허용
- `leaveCountMode`: `allLeaves` 또는 `offOnly`
- `carryOverEnabled`: boolean

`targetMode=weekly`여도 `fixedMonthlyOffDays` 값을 저장해 주세요. 반대로 `targetMode=fixed`여도 `weeklyOffDays` 값을 저장해 주세요. 사용자가 모드를 바꿨다가 되돌릴 때 이전 입력값을 유지하기 위함입니다.

## 공휴일 국가 결정

프론트 기준 언어별 기본 공휴일 국가는 아래와 같습니다.

```ts
ko -> KR
ja -> JP
en -> US
zh -> CN
th -> TH
vi -> VN
```

백엔드는 조회/저장 응답에 계산 기준 확인용 `holidayCountry`를 포함해 주세요. 우선순위는 아래 중 하나로 정하면 됩니다.

1. 서비스 지역 헤더가 있으면 우선 사용
2. 없으면 `Accept-Language` 또는 사용자 언어 설정 사용
3. 그래도 없으면 서비스 기본값 사용

## 계산 기준

`/make` 화면에서 사용하는 기본 계산식은 아래와 같습니다.

```ts
baseTarget =
    targetMode === 'weekly'
        ? ceil(daysInMonth / 7) * weeklyOffDays
        : fixedMonthlyOffDays;

holidayTarget = includeHolidays ? countPublicHolidays(year, month, holidayCountry) : 0;

monthlyTargetRestDays = baseTarget + holidayTarget + adjustmentDays;

targetRestDays =
    monthlyTargetRestDays
    + (carryOverEnabled ? shiftNurse.carried : 0);
```

실제 배정된 쉬는 날은 근무표 셀의 `wardShiftTypeId`가 `countedRestShiftTypeIds`에 포함되는지로 계산합니다.

```ts
assignedRestDays = count(schedule cells where wardShiftTypeId is in countedRestShiftTypeIds);
differenceDays = assignedRestDays - targetRestDays;
```

- `differenceDays < 0`: 부족
- `differenceDays > 0`: 초과
- `differenceDays = 0`: 맞음

## 월별 목표 쉬는 날 임시 보정

`/make` 화면에는 해당 월/근무팀에서만 목표 쉬는 날을 `+1` 또는 `-1` 조정하는 UI가 있습니다.

현재는 프론트 `localStorage`로 관리하고 있습니다. 백엔드 저장까지 포함한다면 아래 키 기준을 권장합니다.

```text
(wardId, shiftTeamId, year, month)
```

제안 API:

```http
GET /wards/{wardId}/shift-teams/{shiftTeamId}/rest-target-adjustments?year={year}&month={month}
PUT /wards/{wardId}/shift-teams/{shiftTeamId}/rest-target-adjustments
```

Request/response 예시:

```json
{
    "wardId": 421,
    "shiftTeamId": 7,
    "year": 2026,
    "month": 6,
    "adjustmentDays": 1
}
```

이 API는 설정 저장 API보다 후순위여도 됩니다. 우선순위는 병동 단위 `rest-leave-policy` 조회/저장입니다.

## 검증 응답 확장 요청

추후 `POST /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/validate-snapshot` 응답에 간호사별 휴무 체크 요약을 포함해주면 프론트 계산을 백엔드 기준으로 통일할 수 있습니다.

예시:

```json
{
    "restChecks": [
        {
            "shiftNurseId": 1001,
            "nurseId": 501,
            "targetDays": 10,
            "assignedDays": 8,
            "carriedDays": 1,
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

v1에서는 저장/조회 API만 먼저 구현하고, 검증 응답 확장은 후속 작업으로 진행해도 됩니다.

## DB 제약 제안

테이블명 예시:

```text
ward_rest_leave_policy
```

| column | description |
| --- | --- |
| `ward_id` | PK 또는 unique key |
| `enabled` | 기능 사용 여부 |
| `target_mode` | `weekly` 또는 `fixed` |
| `weekly_off_days` | 주당 쉬는 날 수 |
| `fixed_monthly_off_days` | 월 고정 쉬는 날 수 |
| `include_holidays` | 공휴일 포함 여부 |
| `counted_rest_shift_type_ids` | JSON 배열 또는 별도 매핑 테이블 |
| `leave_count_mode` | `allLeaves` 또는 `offOnly` |
| `carry_over_enabled` | 이월 반영 여부 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

## 완료 기준

1. `GET /wards/{wardId}/rest-leave-policy`로 병동별 설정을 조회할 수 있습니다.
2. 저장된 설정이 없는 병동은 기본값을 `200`으로 반환합니다.
3. `PUT /wards/{wardId}/rest-leave-policy`로 설정을 생성/수정할 수 있습니다.
4. 저장한 설정이 다른 브라우저와 같은 병동의 다른 관리자 계정에서도 동일하게 조회됩니다.
5. 권한 없는 병동 조회/수정은 `403`을 반환합니다.
6. 잘못된 enum, 범위 밖 숫자, 다른 병동의 근무유형 ID는 `400`을 반환합니다.
