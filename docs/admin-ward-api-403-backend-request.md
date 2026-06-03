# 관리자 계정 로그인 후 병동 API 403 확인 및 수정 요청

## 배경

관리자 계정으로 이전에 병동을 생성한 뒤, 나중에 다시 로그인하면 생성했던 병동 화면이 바로 보여야 합니다.

현재 dev 환경에서는 로그인 후 병동 화면에 진입해도 병동 데이터가 로드되지 않고, 병동 관련 API가 반복적으로 403을 반환합니다.

## 원하는 로그인/병동 복귀 흐름

프론트에서 기대하는 기준은 "서버가 현재 로그인한 계정의 마지막 유효 소속 병동을 알려주고, 그 병동 데이터를 바로 조회할 수 있게 해주는 것"입니다.

### 기존 병동 소속이 있는 사용자

사용자가 이전에 병동을 만들었거나 기존 병동에 참여했고, 그 소속이 아직 유효하다면 재로그인 시 아래처럼 동작해야 합니다.

```text
1. 사용자 로그인
2. 프론트가 GET /admin/accounts/me 호출
3. 백엔드가 마지막 유효 소속 병동 wardId를 내려줌
4. 프론트가 해당 wardId로 병동 데이터를 조회
5. 병동 화면이 바로 로드됨
```

예를 들어 사용자가 마지막으로 `wardId=301` 병동에 소속되어 있었다면, 재로그인 후 `/admin/accounts/me`가 `wardId=301`을 내려주고, 이어지는 병동 데이터 조회도 성공해야 합니다.

### 새 가입자 또는 병동 소속이 없는 사용자

반대로 새로 가입한 사용자처럼 아직 유효한 병동 소속이 없다면, 병동 데이터를 조회하려고 하면 안 됩니다.

이 경우에는 `/admin/accounts/me`에서 `wardId=null` 또는 소속 없음 상태를 내려주고, 프론트는 온보딩 화면에서 아래 선택지를 보여줘야 합니다.

- 새 병동 만들기
- 기존 병동 들어가기

### 잘못된 상태를 피해야 하는 경우

가장 피해야 하는 상태는 아래와 같습니다.

```text
/admin/accounts/me는 wardId=301을 내려줌
하지만 /wards/301 계열 병동 데이터 조회는 403으로 막힘
```

이 상태가 되면 프론트는 "이 사용자가 301번 병동에 소속되어 있다"고 믿고 병동 화면으로 보내지만, 실제 데이터는 아무것도 불러오지 못합니다.

따라서 백엔드는 `wardId`를 내려줄 때 반드시 그 계정이 해당 병동 데이터를 조회할 수 있는 권한도 함께 보장해야 합니다. 만약 `current_ward_id`가 더 이상 유효하지 않다면, 다른 ACTIVE membership 병동을 선택하거나 `wardId=null`로 내려줘야 합니다.

## 사용자 관찰 현상

- 로그인은 성공한 것으로 보입니다.
- 로그인 직후 병동 화면으로 이동하지만 병동 정보/근무표/요청/채팅 정보가 로드되지 않습니다.
- 콘솔에는 아래와 같은 403 에러가 반복됩니다.

```text
{message: "관리자 계정은 관리자 계정 API를 사용해야 합니다."}

GET https://dev.api.dutying.net/wards/301 403
GET https://dev.api.dutying.net/wards/301/waiting-nurses/v2 403
GET https://dev.api.dutying.net/wards/301/chat/unread-count 403
GET https://dev.api.dutying.net/wards/301/shift-teams 403
GET https://dev.api.dutying.net/wards/301/shift-teams/530/req-duty?year=2026&month=7 403
GET https://dev.api.dutying.net/wards/301/shift-teams/530/req-duty/req-list?year=2026&month=7 403
```

## 현재 프론트 흐름

로그인 후 프론트는 관리자 계정 정보를 아래 API로 조회합니다.

```http
GET /admin/accounts/me
```

이 응답에서 `wardId`를 받아 auth store에 저장하고, 병동 화면은 해당 `wardId`로 병동 API를 호출합니다.

예상 흐름:

```text
1. 관리자 로그인 성공
2. GET /admin/accounts/me 호출
3. 응답의 wardId가 301로 설정됨
4. 프론트가 /wards/301 계열 API 호출
5. 서버가 "관리자 계정은 관리자 계정 API를 사용해야 합니다." 메시지와 함께 403 반환
```

관련 프론트 코드:

- `apps/app/src/features/auth/index.ts`
  - `AdminAPI.getMe()`로 계정 조회
  - `setAccountMeSuccess()`에서 `wardId` 저장
- `apps/app/src/shared/api/admin/index.ts`
  - `GET /admin/accounts/me`
- `apps/app/src/shared/api/ward/index.ts`
  - `WardAPI = createWardApi(axiosInstance)`
- `packages/api/src/ward/create-ward-api.ts`
  - `/wards/{wardId}` 계열 병동 API 정의

## 현재 의심 지점

프론트가 관리자 로그인 이후에도 병동 데이터 조회에는 기존 `/wards/{wardId}` 계열 API를 사용하고 있습니다.

서버 응답 메시지상 백엔드는 관리자 계정에 대해 일반 계정용 병동 API 사용을 막고, 관리자 전용 API 사용을 요구하는 것으로 보입니다.

즉 현재 불일치는 아래 둘 중 하나일 가능성이 큽니다.

### 1. API 계약 불일치

관리자 계정도 병동 화면에서 기존 병동 데이터를 조회해야 하지만, 백엔드가 `/wards/{wardId}` 계열 API를 관리자 계정에 대해 차단하고 있습니다.

이 경우 백엔드에서 관리자 계정의 active membership을 확인한 뒤 `/wards/{wardId}` 계열 API 접근을 허용해야 합니다.

### 2. 프론트가 호출해야 하는 관리자 전용 병동 API가 따로 있음

백엔드 의도상 관리자 계정은 반드시 `/admin/wards/{wardId}` 같은 관리자 전용 API를 써야 한다면, 프론트가 사용할 정확한 엔드포인트 계약이 필요합니다.

현재 프론트에는 병동 상세, 근무팀, 대기 간호사, 신청 근무, 채팅 unread count 등에 대응하는 관리자 전용 API 계약이 명확히 연결되어 있지 않습니다.

## 백엔드 확인 요청

아래 항목 확인 부탁드립니다.

1. `GET /admin/accounts/me` 응답에서 내려주는 `wardId=301`이 현재 로그인한 관리자 계정의 active membership 병동이 맞나요?
2. 해당 관리자 계정에 `ward_admin_memberships` ACTIVE row가 `wardId=301`로 존재하나요?
3. `current_ward_id`가 존재하지만 해당 병동 active membership이 없어진 경우 백엔드는 어떤 값을 내려주나요?
   - 다른 ACTIVE membership이 있으면 마지막 유효 병동 또는 선택 가능한 병동을 내려줘야 합니다.
   - ACTIVE membership이 없다면 `wardId=null` 또는 온보딩 필요 상태를 내려줘야 합니다.
   - 접근할 수 없는 `wardId`를 내려주면 프론트가 병동 화면으로 진입한 뒤 데이터 조회에서 403이 발생합니다.
4. 관리자 계정이 병동 화면에서 아래 API를 호출하는 것이 허용되어야 하나요?

```http
GET /wards/{wardId}
GET /wards/{wardId}/shift-teams
GET /wards/{wardId}/waiting-nurses/v2
GET /wards/{wardId}/chat/unread-count
GET /wards/{wardId}/shift-teams/{shiftTeamId}/req-duty
GET /wards/{wardId}/shift-teams/{shiftTeamId}/req-duty/req-list
```

5. 허용되지 않는다면 관리자 계정용 대체 API 경로를 공유 부탁드립니다.

예:

```http
GET /admin/wards/{wardId}
GET /admin/wards/{wardId}/shift-teams
GET /admin/wards/{wardId}/waiting-nurses/v2
GET /admin/wards/{wardId}/chat/unread-count
GET /admin/wards/{wardId}/shift-teams/{shiftTeamId}/req-duty
GET /admin/wards/{wardId}/shift-teams/{shiftTeamId}/req-duty/req-list
```

6. `/accounts/default-images`도 관리자 계정 토큰에서 403이 발생합니다. 관리자 프로필에서도 기본 이미지 목록이 필요하므로 아래 중 어떤 계약이 맞는지 확인 부탁드립니다.

```http
GET /accounts/default-images
```

또는

```http
GET /admin/accounts/default-images
```

## 백엔드 수정 요청 방향

권장 방향은 둘 중 하나로 API 계약을 일관되게 맞추는 것입니다.

### A안: 기존 병동 API를 관리자 계정에도 허용

관리자 계정이 해당 병동의 active membership을 가지고 있으면 `/wards/{wardId}` 계열 API 접근을 허용합니다.

권한 판단 기준:

```text
principalType = WARD_ADMIN
AND ward_admin_memberships.account_id = current admin account
AND ward_admin_memberships.ward_id = requested wardId
AND ward_admin_memberships.status = ACTIVE
```

장점:

- 현재 프론트 변경 범위가 작습니다.
- 기존 병동 화면 API 계약을 유지할 수 있습니다.
- 관리자/일반 계정의 병동 데이터 조회 UX를 빠르게 복구할 수 있습니다.

### B안: 관리자 전용 병동 API 제공

관리자 계정은 `/admin/wards/{wardId}` 계열 API만 사용하도록 합니다.

이 경우 프론트에서 기존 `WardAPI`와 별도로 `AdminWardAPI`를 만들 수 있도록, 병동 화면에서 필요한 모든 API 경로와 응답 스키마를 제공해야 합니다.

필요 API:

```http
GET /admin/wards/{wardId}
GET /admin/wards/{wardId}/shift-teams
GET /admin/wards/{wardId}/waiting-nurses/v2
GET /admin/wards/{wardId}/chat/unread-count
GET /admin/wards/{wardId}/shift-teams/{shiftTeamId}/req-duty
GET /admin/wards/{wardId}/shift-teams/{shiftTeamId}/req-duty/req-list
```

응답 스키마는 기존 `/wards/{wardId}` 계열과 동일하거나, 차이가 있다면 프론트 반영을 위해 명시가 필요합니다.

## 기대 동작

이전에 관리자 계정으로 병동을 생성했거나 기존 병동에 참여했던 사용자가 다시 로그인하면:

1. `/admin/accounts/me`에서 active membership에 해당하는 `wardId`가 내려옵니다.
2. 프론트가 해당 병동 데이터를 조회할 수 있습니다.
3. 병동 화면, 근무표 생성 화면, 신청 근무 화면, 채팅 unread count가 403 없이 로드됩니다.
4. 권한이 정말 없는 병동에 접근했을 때만 명확한 403이 발생합니다.

새로 가입했거나 유효한 병동 소속이 없는 사용자가 로그인하면:

1. `/admin/accounts/me`에서 `wardId=null` 또는 온보딩 필요 상태가 내려옵니다.
2. 프론트는 병동 데이터 API를 호출하지 않습니다.
3. 사용자는 새 병동 만들기 또는 기존 병동 들어가기 화면으로 이동합니다.

백엔드는 `wardId`를 내려주는 순간, 해당 계정이 그 병동의 데이터를 조회할 수 있다는 것도 같이 보장해야 합니다.

## 프론트 임시 대응 가능 범위

백엔드 계약이 확정되기 전까지 프론트에서는 403 발생 시 사용자에게 "병동 접근 권한을 확인할 수 없습니다" 같은 안내 화면을 보여주는 방어 처리는 가능합니다.

다만 현재 문제는 로그인한 관리자 계정의 정상 병동 접근이 막히는 것이므로, 근본 해결은 백엔드 API 권한 정책 또는 관리자 전용 API 계약 정리가 필요합니다.
