# 신청근무 접수 알림 앱 구현 요청

작성일: 2026-07-27

## 배경

웹 관리자 화면의 `신청근무 접수` 설정에서 접수 기간 제한과 앱 알림 옵션을 설정할 수 있습니다.

관리자가 알림 옵션을 켜면 서버는 접수 시작 시점과 마감 24시간 전 시점에 해당 병동과 연동된 활성 간호사 계정에게 신청근무 접수 알림을 보냅니다. 앱에서는 이 푸시를 수신하고, 사용자가 알림을 눌렀을 때 신청근무 화면으로 이동할 수 있어야 합니다.

## 현재 서버 구현 상태

- 설정 조회/저장 API가 구현되어 있습니다.
  - `GET /wards/{wardId}/req-shifts/reception-settings`
  - `PUT /wards/{wardId}/req-shifts/reception-settings`
- 앱/관리자에서 대상 월 접수 상태를 조회하는 API가 구현되어 있습니다.
  - `GET /wards/{wardId}/req-shifts/reception-status?year={year}&month={month}`
- 앱의 신청근무 생성/수정/삭제 API는 접수 기간 밖 요청을 서버에서 차단합니다.
  - 차단 시 `REQ_SHIFT_RECEPTION_CLOSED`, HTTP `409 Conflict`
- 서버는 설정 저장 시 90일 범위의 `OPEN`, `CLOSING_SOON` 예약 알림을 만들고, 매일 00:10에 장기 예약을 다시 채웁니다.
- 서버는 매분 due 예약 알림을 처리합니다.
- 수신 대상은 해당 병동의 활성/연동 간호사 계정입니다.
  - `nurse.isActive = true`
  - `nurse.isConnected = true`
  - `nurse.isDeleted = false`
  - `account.status = LINKED`
  - `account.isDeleted = false`
- 서버는 수신자별 인앱 알림 row를 만들고, commit 이후 FCM push를 발송합니다.
- 앱 알림 설정의 `wardAppliedDuty`가 꺼져 있으면 `REQ_SHIFT_RECEPTION` 알림 row와 push가 생성되지 않습니다.

## 알림 종류

| 서버 타입 | 의미 | 현재 서버 문구 |
| --- | --- | --- |
| `OPEN` | 접수 시작 | `다음 달 신청근무 접수가 시작되었습니다.` |
| `CLOSING_SOON` | 마감 24시간 전 | `다음 달 신청근무 접수 마감이 24시간 남았습니다.` |

마감 완료 알림은 현재 1차 범위에 없습니다.

## 현재 FCM data payload

현재 서버의 일반 알림 FCM data는 아래 형식으로 내려갑니다.

```json
{
  "notificationId": "12345",
  "classification": "REQ_SHIFT_RECEPTION",
  "domain": "WARD_REQ_SHIFT",
  "sourceType": "REQ_SHIFT_RECEPTION",
  "sourceId": "678",
  "url": "https://www.dutying.ai/app"
}
```

필드 의미:

| field | value | 설명 |
| --- | --- | --- |
| `notificationId` | 알림 row id | 앱 알림함 읽음 처리/상세 재조회에 사용 |
| `classification` | `REQ_SHIFT_RECEPTION` | 신청근무 접수 알림 분기값 |
| `domain` | `WARD_REQ_SHIFT` | 신청근무 도메인 분기값 |
| `sourceType` | `REQ_SHIFT_RECEPTION` | source 종류 |
| `sourceId` | 예약 알림 id | 서버 내부 예약 알림 id |
| `url` | 현재 기본 앱 링크 | 아직 신청근무 화면 전용 deep link는 아님 |

주의: 현재 payload에는 `wardId`, `year`, `month`, `event`가 없습니다. 앱은 이 필드들이 내려온다는 전제로 구현하면 안 됩니다.

## 앱 구현 요청

### 1. 푸시 수신 분기

앱은 FCM data에서 아래 조건 중 하나를 만족하면 신청근무 접수 알림으로 처리해주세요.

```text
classification == "REQ_SHIFT_RECEPTION"
```

또는

```text
domain == "WARD_REQ_SHIFT" && sourceType == "REQ_SHIFT_RECEPTION"
```

notification payload의 title/body는 OS 표시용으로 사용하고, 라우팅 판단은 data payload 기준으로 처리해주세요.

### 2. 알림 클릭 라우팅

신청근무 접수 알림을 누르면 앱의 신청근무 화면으로 이동해주세요.

현재 서버 payload에는 대상 `wardId/year/month`가 없으므로 앱에서는 아래 순서로 대상 화면을 결정해주세요.

1. 현재 로그인 계정 정보를 기준으로 연동된 병동을 확인합니다.
2. 신청근무 기본 대상 월을 선택합니다.
   - 기존 앱의 신청근무 화면 진입 기본값을 우선 사용
   - 기본값이 없다면 서버 시간 기준 다음 달을 권장
3. 신청근무 화면 진입 직후 `reception-status`를 재조회합니다.
4. `canSubmit` 값에 따라 신청/수정 가능 여부와 안내 문구를 갱신합니다.

알림 클릭 시 이미 앱이 실행 중이어도 동일하게 신청근무 화면으로 이동하고 상태를 재조회해주세요.

### 3. 접수 상태 조회

신청근무 화면 진입 시 대상 월에 대해 아래 API를 호출해주세요.

```http
GET /wards/{wardId}/req-shifts/reception-status?year=2026&month=8
Authorization: Bearer {accessToken}
```

응답 예시:

```json
{
  "enabled": true,
  "status": "OPEN",
  "canSubmit": true,
  "opensAt": "2026-07-01T00:00:00+09:00",
  "closesAt": "2026-07-15T23:59:00+09:00",
  "serverNow": "2026-07-01T09:00:00+09:00"
}
```

`status` 처리:

| status | 앱 동작 |
| --- | --- |
| `UNLIMITED` | 기존처럼 신청/수정 가능 |
| `BEFORE_OPEN` | 신청/수정 UI 비활성화, 접수 시작 시점 표시 |
| `OPEN` | 신청/수정 가능, 접수 마감 시점 표시 |
| `CLOSED` | 신청/수정 UI 비활성화, 접수 마감 안내 표시 |

### 4. 저장 실패 처리

앱 화면을 열어둔 사이 접수 상태가 바뀔 수 있으므로, 신청근무 저장/수정/삭제 API에서 아래 에러를 받으면 상태를 다시 조회하고 읽기 전용으로 전환해주세요.

```json
{
  "code": "REQ_SHIFT_RECEPTION_CLOSED",
  "message": "신청근무 접수 기간이 아닙니다.",
  "messageKey": "error.reqShiftReceptionClosed",
  "receptionStatus": "CLOSED",
  "opensAt": "2026-07-01T00:00:00+09:00",
  "closesAt": "2026-07-15T23:59:00+09:00"
}
```

요청 처리:

- 토스트 또는 하단 안내로 저장 실패를 표시합니다.
- `reception-status`를 다시 조회합니다.
- 최신 상태 기준으로 신청/수정 가능 여부를 갱신합니다.

### 5. 앱 알림 설정 연동

앱 알림 설정에 `신청근무 접수 알림` 항목을 `wardAppliedDuty`와 연결해주세요.

사용자가 이 설정을 끄면 서버에서 `REQ_SHIFT_RECEPTION` 알림 row와 push 생성이 생략됩니다. 앱에서는 설정 화면의 토글 상태가 서버와 동기화되어야 합니다.

### 6. 토큰 등록 확인

앱 로그인 또는 푸시 권한 허용 이후 FCM 토큰을 서버에 등록해주세요.

권장 API:

```http
PUT /accounts/me/push-token
Content-Type: application/json
Authorization: Bearer {accessToken}
```

```json
{
  "deviceToken": "{fcmToken}",
  "devicePlatform": "IOS",
  "provider": "FCM"
}
```

기존 호환 API를 사용 중인 앱은 `/accounts/me/fcm-token`도 사용할 수 있지만, 신규 구현은 `/accounts/me/push-token`을 권장합니다.

## 서버 보강 협의 항목

아래는 앱 구현을 더 안정적으로 만들기 위한 백엔드 보강 후보입니다. 현재 앱 구현은 이 값들이 없을 수 있음을 전제로 진행해주세요.

- FCM data에 `wardId`, `year`, `month`, `event` 추가
- `url`을 신청근무 화면 전용 deep link로 변경
  - 예: `https://www.dutying.ai/app/request-shift?wardId=1&year=2026&month=8`
- 알림 문구에 실제 대상 월 표시
  - 예: `8월 신청근무 접수가 시작되었습니다.`
- `sourceId`만으로 예약 알림 상세를 조회할 수 있는 API 제공 여부 결정

## QA 체크리스트

- 앱이 종료된 상태에서 푸시 클릭 시 신청근무 화면으로 이동합니다.
- 앱이 백그라운드 상태에서 푸시 클릭 시 신청근무 화면으로 이동합니다.
- 앱이 포그라운드 상태에서 수신한 알림을 눌렀을 때 신청근무 화면으로 이동합니다.
- `classification=REQ_SHIFT_RECEPTION` data payload를 안정적으로 분기합니다.
- 신청근무 화면 진입 직후 `reception-status`를 재조회합니다.
- `BEFORE_OPEN`, `OPEN`, `CLOSED`, `UNLIMITED` 상태별 UI가 의도대로 표시됩니다.
- `REQ_SHIFT_RECEPTION_CLOSED` 저장 실패 후 상태 재조회와 UI 비활성화가 동작합니다.
- 앱 알림 설정에서 `wardAppliedDuty`를 끄면 이후 신청근무 접수 push가 오지 않습니다.
- FCM 토큰 미등록 계정에서는 push가 오지 않지만, 서버 요청 자체는 실패하지 않습니다.
