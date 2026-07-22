# 병동 입장 승인 상태 동기화 백엔드 싱크

- 작성일: 2026-07-22
- 대상: 모바일 앱 팀
- 범위: DB 스키마 변경 없는 1차 동기화

## 결론

DB는 변경하지 않고, 기존 `waiting_nurse` row를 pending 요청으로 사용합니다.

- pending 상태: `waiting_nurse` row 있음
- 승인/연결 완료: row 삭제 후 `GET /accounts/me`에서 `LINKED`
- 거절/취소: row 삭제 후 `GET /accounts/me`에서 `WARD_SELECT_PENDING`

따라서 서버가 나중에 상태 조회 API만 보고 `APPROVED`, `REJECTED`, `CANCELLED` 이력을 다시 내려주는 것은 1차 범위에 포함하지 않습니다. 처리 순간의 결과는 푸시 알림과 SSE 이벤트로 내려가고, 앱은 이벤트 수신 후 `GET /accounts/me`를 다시 호출해 최종 상태를 확정하면 됩니다.

## 유지되는 기존 API

기존 앱/웹 API는 유지됩니다.

```http
GET /accounts/waiting
POST /wards/{wardId}/waiting-nurses
DELETE /wards/{wardId}/waiting-nurses?nurseId={nurseId}
DELETE /wards/{wardId}/waiting-nurses/{waitingNurseId}/v1
POST /wards/{wardId}/waiting-nurses/{waitingNurseId}/approve?shiftTeamId={shiftTeamId}
POST /wards/{wardId}/waiting-nurses/{waitingNurseId}/accept
POST /wards/{wardId}/waiting-nurses/{waitingNurseId}/connect?targetNurseId={targetNurseId}
```

## 신규 pending 조회 API

```http
GET /accounts/me/ward-join-request
```

### 200 OK

현재 로그인 계정의 pending 요청이 있으면 반환합니다. `requestId`는 DB 변경 전까지 `waitingNurseId`와 같습니다.

```json
{
    "requestId": 1234,
    "status": "PENDING",
    "ward": {
        "wardId": 10,
        "wardName": "7병동",
        "wardCode": "A1B2C3",
        "hospitalName": "듀팅병원"
    },
    "requestedAt": "2026-07-22T10:15:00",
    "updatedAt": "2026-07-22T10:15:00"
}
```

### 204 No Content

pending 요청이 없으면 `204`를 반환합니다.

## 입장 요청 생성 응답

```http
POST /wards/{wardId}/waiting-nurses
```

성공 시 기존과 동일하게 `201 Created`이며, 응답 body가 추가됩니다. 기존 클라이언트는 body를 무시해도 됩니다.

```json
{
    "requestId": 1234,
    "status": "PENDING",
    "wardId": 10,
    "requestedAt": "2026-07-22T10:15:00"
}
```

## 본인 요청 취소

```http
DELETE /wards/{wardId}/waiting-nurses
```

현재 로그인 사용자의 해당 병동 pending 요청을 취소합니다.

- 성공: `204 No Content`
- SSE 이벤트: `status = CANCELLED`
- 별도 푸시 알림은 보내지 않습니다.

## 관리자 거절 처리

아래 기존 삭제 API는 신청자 기준으로 `REJECTED` 처리 이벤트를 발행합니다.

```http
DELETE /wards/{wardId}/waiting-nurses?nurseId={nurseId}
DELETE /wards/{wardId}/waiting-nurses/{waitingNurseId}/v1
```

신청자에게는 `WARD_JOIN_REJECTED` 푸시/인앱 알림과 SSE 이벤트가 발행됩니다.

## 승인/연결 처리

아래 기존 승인/연결 API가 실제 연결에 성공하면 신청자에게 `APPROVED` 결과를 발행합니다.

```http
POST /wards/{wardId}/waiting-nurses/{waitingNurseId}/approve?shiftTeamId={shiftTeamId}
POST /wards/{wardId}/waiting-nurses/{waitingNurseId}/accept
POST /wards/{wardId}/waiting-nurses/{waitingNurseId}/connect?targetNurseId={targetNurseId}
```

앱은 승인 이벤트 수신 후 `GET /accounts/me`를 호출해 `wardId`, `shiftTeamId`, `status`를 최종 반영하면 됩니다.

## 푸시/인앱 알림

승인:

```json
{
    "classification": "WARD_JOIN_APPROVED",
    "domain": "WARD",
    "sourceType": "WARD_JOIN_REQUEST",
    "sourceId": "1234",
    "url": "/app/ward"
}
```

거절:

```json
{
    "classification": "WARD_JOIN_REJECTED",
    "domain": "WARD",
    "sourceType": "WARD_JOIN_REQUEST",
    "sourceId": "1234",
    "url": "/app/ward"
}
```

FCM data에는 기존 공통 필드인 `notificationId`, `classification`, `domain`, `sourceType`, `sourceId`, `url`이 포함됩니다. `wardId`, `status`는 SSE 이벤트 payload에서 확인하거나, 푸시 클릭 후 `GET /accounts/me` 재조회로 확정해주세요.

## SSE 이벤트

구독:

```http
GET /events/stream
```

이벤트 이름:

```text
WARD_JOIN_REQUEST_UPDATED
```

이벤트 data는 기존 `RealtimeEventDto` 래퍼이며, `payload`는 아래 형식입니다.

```json
{
    "eventId": "ward-join-request-1234-APPROVED",
    "type": "WARD_JOIN_REQUEST_UPDATED",
    "occurredAt": "2026-07-22T10:25:00",
    "payload": {
        "requestId": 1234,
        "status": "APPROVED",
        "wardId": 10,
        "updatedAt": "2026-07-22T10:25:00"
    }
}
```

가능한 `payload.status`:

- `APPROVED`
- `REJECTED`
- `CANCELLED`

`EXPIRED`는 DB 이력/만료 정책이 없어 1차 범위에서는 발행하지 않습니다.

## 앱 권장 처리

1. 입장 요청 성공 후 응답의 `requestId`를 보관합니다.
2. 앱 실행 중이면 `/events/stream`을 구독합니다.
3. `WARD_JOIN_REQUEST_UPDATED` 이벤트를 받으면 `GET /accounts/me`를 즉시 재조회합니다.
4. `GET /accounts/me/ward-join-request`가 `204`면 더 이상 pending 요청은 없습니다.
5. 이벤트를 놓칠 수 있으므로 기존 polling 또는 앱 복귀 시 재조회는 유지합니다.

## 주의사항

- DB 변경 없는 1차 범위에서는 처리 완료 후 요청 row가 삭제되므로, 상태 조회 API에서 완료 이력을 복원할 수 없습니다.
- 승인/거절 결과 화면의 최종 진입 가능 여부는 반드시 `GET /accounts/me` 응답을 기준으로 판단해주세요.
- `requestedAt`, `updatedAt`, `occurredAt`은 서버의 기존 KST `LocalDateTime` 응답 형식을 따릅니다.
