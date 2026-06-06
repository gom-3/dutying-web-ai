# 연동관리 대기 간호사 팀 추가 403 현황

## 상황

관리자 웹의 `근무자 관리 > 연동관리`에서 연동 신청이 들어온 사용자를 기존 근무팀에 추가하려고 할 때 실패한다.

화면에서는 팀 추가 실패 상태로 전환되고, 브라우저 콘솔에는 아래 요청이 403으로 기록된다.

```text
POST https://dev.api.dutying.net/wards/322/waiting-nurses/37/approve?shiftTeamId=553 403 (Forbidden)
```

응답 body:

```json
{
  "code": "ACCESS_DENIED",
  "message": "병동 관리자 권한이 필요합니다."
}
```

## 발생 위치

프론트 호출 흐름은 아래와 같다.

```text
apps/app/src/pages/member/ui/connection-manage.tsx
-> useConnectionManageController
-> useEditWard().actions.approveWaitingNurses
-> WardAPI.approveWaitingNurses
-> POST /wards/{wardId}/waiting-nurses/{waitingNurseId}/approve?shiftTeamId={shiftTeamId}
```

관련 프론트 코드:

- `apps/app/src/features/edit-ward/index.ts`
  - `approveWaitingNurses(waitingNurseId, shiftTeamId)`에서 현재 auth store의 `wardId`를 사용한다.
  - 호출 성공 시 병동 정보와 대기 간호사 목록 query를 invalidate한다.
- `packages/api/src/ward/create-ward-api.ts`
  - `approveWaitingNurses`는 아래 경로로 요청을 만든다.

```ts
client.post<void>(
  `/wards/${wardId}/waiting-nurses/${waitingNurseId}/approve?shiftTeamId=${shiftTeamId}`,
)
```

실제 에러 케이스에서는 다음 값으로 호출되었다.

```text
wardId=322
waitingNurseId=37
shiftTeamId=553
```

## 첨부 OpenAPI 명세 기준 확인 내용

현재 확인한 OpenAPI 명세에는 대기 간호사 관련 API가 `/wards/...` 계열로 정의되어 있다.

확인된 path:

```text
GET    /wards/{wardId}/waiting-nurses
POST   /wards/{wardId}/waiting-nurses
DELETE /wards/{wardId}/waiting-nurses
GET    /wards/{wardId}/waiting-nurses/v2
POST   /wards/{wardId}/waiting-nurses/{waitingNurseId}/approve
POST   /wards/{wardId}/waiting-nurses/{waitingNurseId}/connect
POST   /wards/{wardId}/waiting-nurses/{waitingNurseId}/accept
DELETE /wards/{wardId}/waiting-nurses/{waitingNurseId}/v1
```

`POST /wards/{wardId}/waiting-nurses/{waitingNurseId}/approve` 명세:

```text
summary: 대기 간호사 추가 승인
description: 병동 내의 대기 간호사 명단에서 간호사를 추가합니다.
parameters:
  wardId: path, required
  waitingNurseId: path, required
  shiftTeamId: query, required
responses:
  201 Created
```

같은 명세에서 `/admin/wards/{wardId}/waiting-nurses/...` 형태의 관리자 전용 대기 간호사 approve/connect API는 확인되지 않았다.

## 현재 관찰된 현상 정리

- 프론트가 호출한 approve API 경로는 첨부 OpenAPI에 존재한다.
- 요청은 네트워크/라우팅 단계에서 실패한 것이 아니라 서버 응답으로 `403 ACCESS_DENIED`를 받았다.
- 서버 응답 메시지는 `병동 관리자 권한이 필요합니다.`이다.
- 프론트는 관리자 웹 로그인 후 auth store의 `wardId`를 사용해 해당 API를 호출한다.
- 같은 연동관리 화면에서 팀 추가 동작은 `approve`, 기존 간호사와 연결하는 동작은 `connect`를 사용한다.
- 첨부 OpenAPI에는 자동 수락용 `POST /wards/{wardId}/waiting-nurses/{waitingNurseId}/accept`도 존재한다.

## 영향

관리자 웹에서 연동 신청자가 대기 간호사 목록에 표시되더라도, 해당 사용자를 팀에 추가하는 완료 단계에서 403이 발생한다.

그 결과 연동 신청자를 신규 근무자로 승인하여 팀에 배치할 수 없다.

## 현재 미확인 상태

아래 값들이 서버 권한 판정에서 어떤 상태로 인식되는지는 프론트에서 확인할 수 없다.

```text
현재 로그인한 관리자 계정이 wardId=322에 대해 병동 관리자 권한을 가진 상태인지
waitingNurseId=37이 wardId=322의 대기 간호사인지
shiftTeamId=553이 wardId=322에 속한 근무팀인지
해당 approve API가 관리자 웹 JWT에서 호출 가능한 API인지
```

