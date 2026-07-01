# 신청근무 접수 기간 설정 백엔드 API 요청

## 배경

`https://dev.dutying.net/ward-settings?tab=requestReception` 화면에는 병동 관리자가 다음 달 신청근무 접수 기간을 설정하는 UI가 들어가 있습니다.

이 기능을 켠 병동은 간호사가 앱에서 정해진 기간에만 다음 달 신청근무를 제출하거나 수정할 수 있어야 합니다. 기능을 끈 병동은 기존처럼 기간 제한 없이 신청근무를 받을 수 있습니다.

프론트엔드에는 병동 설정 UI와 API 클라이언트가 이미 연결되어 있고, 현재 백엔드 엔드포인트가 없어 실제 저장/조회가 실패하는 상태입니다.

## 현재 프론트 동작

- 위치: 병동 설정 > 신청근무 접수 탭
- URL: `/ward-settings?tab=requestReception`
- API client:
  - `WardAPI.getReqShiftReceptionSettings(wardId)`
  - `WardAPI.updateReqShiftReceptionSettings(wardId, settings)`
- 관련 코드:
  - `packages/api/src/ward/contracts.ts`
  - `packages/api/src/ward/create-ward-api.ts`
  - `apps/app/src/pages/ward-settings/model/ward-settings-hook.ts`
  - `apps/app/src/pages/ward-settings/ui/index.tsx`

현재 UI는 접수 시작일/종료일만 선택합니다. 시간은 프론트에서 아래 고정값으로 보냅니다.

```text
startTime = "00:00"
endTime = "23:59"
notifyBeforeDeadlineHours = 24
```

## 설정 모델

```ts
type ReqShiftReceptionSettings = {
    enabled: boolean;
    startDay: number;
    startTime: string;
    endDay: number;
    endTime: string;
    notifyOnOpen: boolean;
    notifyBeforeDeadline: boolean;
    notifyBeforeDeadlineHours: number;
    updatedAt?: string | null;
};
```

## 기본값

설정이 아직 없는 병동은 아래 기본값으로 응답해주세요.

```json
{
    "enabled": false,
    "startDay": 1,
    "startTime": "00:00",
    "endDay": 15,
    "endTime": "23:59",
    "notifyOnOpen": true,
    "notifyBeforeDeadline": true,
    "notifyBeforeDeadlineHours": 24,
    "updatedAt": null
}
```

설정이 없을 때도 `404`가 아니라 기본값을 채운 `200` 응답을 반환해주세요.

## API

### 신청근무 접수 설정 조회

```http
GET /wards/{wardId}/req-shifts/reception-settings
Authorization: Bearer {adminToken}
```

#### Response 200

```json
{
    "enabled": true,
    "startDay": 1,
    "startTime": "00:00",
    "endDay": 15,
    "endTime": "23:59",
    "notifyOnOpen": true,
    "notifyBeforeDeadline": true,
    "notifyBeforeDeadlineHours": 24,
    "updatedAt": "2026-06-23T09:10:00+09:00"
}
```

### 신청근무 접수 설정 저장

```http
PUT /wards/{wardId}/req-shifts/reception-settings
Content-Type: application/json
Authorization: Bearer {adminToken}
```

같은 `wardId` 설정이 있으면 수정하고, 없으면 생성하는 upsert 방식으로 처리해주세요.

#### Request Body

```json
{
    "enabled": true,
    "startDay": 1,
    "startTime": "00:00",
    "endDay": 15,
    "endTime": "23:59",
    "notifyOnOpen": true,
    "notifyBeforeDeadline": true,
    "notifyBeforeDeadlineHours": 24
}
```

#### Response 200

```json
{
    "enabled": true,
    "startDay": 1,
    "startTime": "00:00",
    "endDay": 15,
    "endTime": "23:59",
    "notifyOnOpen": true,
    "notifyBeforeDeadline": true,
    "notifyBeforeDeadlineHours": 24,
    "updatedAt": "2026-06-23T09:10:00+09:00"
}
```

## 권한

- 병동 관리자 인증 토큰이 필요합니다.
- 요청한 `wardId`에 대해 현재 관리자 계정이 활성 관리자 멤버십을 가지고 있어야 합니다.
- 권한이 없으면 `403 Forbidden`을 반환해주세요.
- 인증이 없거나 만료된 경우 기존 관리자 API 규칙과 동일하게 `401 Unauthorized`를 반환해주세요.

## 검증 규칙

- `enabled`: boolean
- `startDay`: 1 이상 31 이하 정수
- `endDay`: 1 이상 31 이하 정수
- `startDay <= endDay`
- `startTime`: `HH:mm` 형식, 현재 프론트는 `"00:00"` 고정
- `endTime`: `HH:mm` 형식, 현재 프론트는 `"23:59"` 고정
- `notifyOnOpen`: boolean
- `notifyBeforeDeadline`: boolean
- `notifyBeforeDeadlineHours`: 1차에서는 `24`만 허용하거나 서버에서 `24`로 정규화

검증 실패 시 기존 API 에러 포맷을 따라 `400 Bad Request`를 반환해주세요.

## 기간 계산 규칙

접수 기간은 "대상 신청근무 월의 전월" 기준으로 계산합니다.

예를 들어 2026년 7월 신청근무이고 설정이 아래와 같다면:

```json
{
    "startDay": 1,
    "startTime": "00:00",
    "endDay": 15,
    "endTime": "23:59"
}
```

접수 기간은 아래처럼 계산됩니다.

```text
opensAt  = 2026-06-01T00:00:00+09:00
closesAt = 2026-06-15T23:59:00+09:00
```

전월에 해당 날짜가 없으면 해당 월의 마지막 날로 보정해주세요.

예:

```text
대상 월: 2026년 3월 신청근무
전월: 2026년 2월
endDay: 31
closesAt: 2026-02-28T23:59:00+09:00
```

기준 타임존은 병동/서비스 기본 타임존을 사용해주세요. 현재 한국 서비스 기준으로는 `Asia/Seoul`을 기대합니다.

## 앱 제출 차단용 상태 API

간호사 앱은 신청근무 화면 진입 시 대상 월의 접수 상태를 조회할 수 있어야 합니다.

```http
GET /wards/{wardId}/req-shifts/reception-status?year=2026&month=7
Authorization: Bearer {nurseToken}
```

#### Response 200

```json
{
    "enabled": true,
    "status": "OPEN",
    "canSubmit": true,
    "opensAt": "2026-06-01T00:00:00+09:00",
    "closesAt": "2026-06-15T23:59:00+09:00",
    "serverNow": "2026-06-10T13:30:00+09:00"
}
```

`status` 값:

| status | meaning |
| --- | --- |
| `UNLIMITED` | 기간 제한 미사용, 제출/수정 가능 |
| `BEFORE_OPEN` | 접수 시작 전, 제출/수정 불가 |
| `OPEN` | 접수 중, 제출/수정 가능 |
| `CLOSED` | 접수 마감, 제출/수정 불가 |

`canSubmit`은 `status`가 `UNLIMITED` 또는 `OPEN`일 때 `true`입니다.

## 제출/수정 서버 차단

간호사 앱에서 신청근무를 생성/수정/삭제하는 API는 서버에서 반드시 접수 상태를 검증해야 합니다.

기간 밖이면 요청을 거절해주세요. 이미 제출된 신청근무 조회는 계속 가능해야 합니다.

권장 HTTP status:

```http
409 Conflict
```

권장 에러 응답:

```json
{
    "code": "REQ_SHIFT_RECEPTION_CLOSED",
    "message": "신청근무 접수 기간이 아닙니다.",
    "receptionStatus": "CLOSED",
    "opensAt": "2026-06-01T00:00:00+09:00",
    "closesAt": "2026-06-15T23:59:00+09:00"
}
```

웹 관리자용 신청근무 검토/수락/반려 API는 기존 운영 흐름을 위해 1차에서는 차단하지 않는 것을 권장합니다.

## 푸시 알림

설정이 켜져 있고 알림 옵션이 켜진 경우, 대상 월별로 아래 푸시를 예약해주세요.

- 접수 시작 시점: `notifyOnOpen=true`
- 마감 24시간 전: `notifyBeforeDeadline=true`

마감 시점 알림은 1차 범위에 포함하지 않아도 됩니다.

푸시 대상은 해당 병동에 연결된 활성 간호사 계정입니다.

권장 payload:

```json
{
    "type": "REQ_SHIFT_RECEPTION",
    "event": "OPEN",
    "wardId": 1,
    "year": 2026,
    "month": 7
}
```

`event` 값:

- `OPEN`
- `CLOSING_SOON`

같은 병동/대상 월/알림 종류가 중복 발송되지 않도록 dedupe key를 두는 것을 권장합니다.

```text
req-shift-reception:{wardId}:{year}-{month}:{OPEN|CLOSING_SOON}
```

설정이 변경되면 아직 발송되지 않은 예약 알림은 새 계산 결과로 갱신해주세요.

## DB 제약 제안

테이블명 예시:

```text
ward_req_shift_reception_settings
```

| column | description |
| --- | --- |
| `ward_id` | PK 또는 unique key |
| `enabled` | 기간 제한 사용 여부 |
| `start_day` | 접수 시작일 |
| `start_time` | 접수 시작 시간 |
| `end_day` | 접수 종료일 |
| `end_time` | 접수 종료 시간 |
| `notify_on_open` | 접수 시작 푸시 여부 |
| `notify_before_deadline` | 마감 전 푸시 여부 |
| `notify_before_deadline_hours` | 마감 전 알림 시간, v1은 24 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

## 완료 기준

1. `GET /wards/{wardId}/req-shifts/reception-settings`로 병동별 설정을 조회할 수 있습니다.
2. 설정이 없는 병동은 기본값을 `200`으로 반환합니다.
3. `PUT /wards/{wardId}/req-shifts/reception-settings`로 설정을 생성/수정할 수 있습니다.
4. 저장한 설정이 다른 브라우저와 같은 병동의 다른 관리자 계정에서도 동일하게 조회됩니다.
5. 권한 없는 병동 조회/수정은 `403`을 반환합니다.
6. 앱 제출/수정 API는 접수 기간 밖 요청을 서버에서 차단합니다.
7. 앱은 `reception-status` 응답으로 `UNLIMITED`, `BEFORE_OPEN`, `OPEN`, `CLOSED` 상태를 구분할 수 있습니다.
