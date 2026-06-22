# 신청근무 접수 기간 제한 백엔드 요청

## 목적

병동 관리자가 웹에서 다음 달 신청근무 접수 기간을 설정하면, 간호사는 앱에서 해당 기간에만 신청근무를 제출하거나 수정할 수 있어야 합니다.

이 기능은 병동별 선택 기능입니다. 설정을 사용하지 않는 병동은 기존처럼 신청근무를 자유롭게 받을 수 있습니다.

## 1차 범위

- 병동별 신청근무 접수 기간 제한 설정 저장
- 다음 달 신청근무 기준의 월 반복 규칙
- 앱 제출/수정 API의 서버 측 차단
- 접수 시작 푸시 알림
- 마감 24시간 전 푸시 알림

아래 기능은 1차 범위에서 제외합니다.

- 마감 후 알림
- 예외 신청 플로우
- 임시 재오픈
- 관리자 대리 입력 정책 변경

## 설정 API

### GET `/wards/{wardId}/req-shifts/reception-settings`

병동의 신청근무 접수 기간 설정을 조회합니다.

```json
{
  "enabled": true,
  "startDay": 1,
  "startTime": "09:00",
  "endDay": 15,
  "endTime": "23:59",
  "notifyOnOpen": true,
  "notifyBeforeDeadline": true,
  "notifyBeforeDeadlineHours": 24,
  "updatedAt": "2026-06-21T10:00:00+09:00"
}
```

### PUT `/wards/{wardId}/req-shifts/reception-settings`

병동 관리자가 설정을 저장합니다.

```json
{
  "enabled": true,
  "startDay": 1,
  "startTime": "09:00",
  "endDay": 15,
  "endTime": "23:59",
  "notifyOnOpen": true,
  "notifyBeforeDeadline": true,
  "notifyBeforeDeadlineHours": 24
}
```

검증:

- `startDay`, `endDay`: 1~31
- `startTime`, `endTime`: `HH:mm`
- 종료 시점은 시작 시점보다 뒤여야 함
- `notifyBeforeDeadlineHours`: 1차에서는 `24`만 허용하거나 서버에서 `24`로 정규화

## 기간 계산

접수 기간은 "대상 근무 월의 전월" 기준으로 계산합니다.

예: 2026년 7월 신청근무, 설정이 `startDay=1`, `endDay=15`이면

- 접수 시작: 2026-06-01 09:00
- 접수 종료: 2026-06-15 23:59

전월에 해당 일자가 없는 경우에는 해당 월의 마지막 날로 보정합니다.

예: `endDay=31`, 전월이 2026년 2월이면 2026-02-28로 계산합니다.

## 상태 조회 API

앱이 제출 가능 여부를 안정적으로 판단할 수 있도록 상태 API가 필요합니다.

### GET `/wards/{wardId}/req-shifts/reception-status?year=2026&month=7`

```json
{
  "enabled": true,
  "status": "OPEN",
  "canSubmit": true,
  "opensAt": "2026-06-01T09:00:00+09:00",
  "closesAt": "2026-06-15T23:59:00+09:00",
  "serverNow": "2026-06-10T13:30:00+09:00"
}
```

`status` 값:

- `UNLIMITED`: 제한 사용 안 함
- `BEFORE_OPEN`: 접수 전
- `OPEN`: 접수 중
- `CLOSED`: 마감됨

## 제출/수정 차단

간호사 앱에서 신청근무를 생성/수정/삭제하는 API는 서버에서 반드시 접수 상태를 검증해야 합니다.

기간 밖이면 요청을 거절합니다.

권장 에러:

```json
{
  "code": "REQ_SHIFT_RECEPTION_CLOSED",
  "message": "신청근무 접수 기간이 아닙니다.",
  "receptionStatus": "CLOSED",
  "opensAt": "2026-06-01T09:00:00+09:00",
  "closesAt": "2026-06-15T23:59:00+09:00"
}
```

권장 HTTP 상태는 `409 Conflict`입니다.

웹 관리자용 신청근무 검토/수락/반려 API는 기존 운영 흐름을 위해 1차에서 차단하지 않습니다.

## 푸시 알림

설정이 켜져 있고 알림 옵션이 켜진 경우, 대상 월별로 아래 푸시를 예약합니다.

- 접수 시작 시점: `notifyOnOpen=true`
- 마감 24시간 전: `notifyBeforeDeadline=true`

마감 후 알림은 보내지 않습니다.

알림은 병동에 연결된 활성 간호사 계정 대상으로 발송합니다. 같은 병동/대상 월/알림 종류는 중복 발송되지 않도록 dedupe key를 둡니다.

권장 dedupe key:

```text
req-shift-reception:{wardId}:{year}-{month}:{OPEN|CLOSING_SOON}
```

설정이 변경되면 아직 발송되지 않은 예약 알림을 새 계산 결과로 갱신해 주세요.

## 프론트 반영 상태

웹 프론트에는 아래 API 클라이언트가 추가되었습니다.

- `WardAPI.getReqShiftReceptionSettings(wardId)`
- `WardAPI.updateReqShiftReceptionSettings(wardId, settings)`

병동 설정 화면에는 `신청근무 접수` 탭이 추가되어 있습니다.
