# 병동톡 메시지 전송 500 오류 전달 문서

작성일: 2026-06-20

## 요약

dev 환경에서 병동톡 메시지 전송 시 아래 API가 500을 반환합니다.

```http
POST https://dev.api.dutying.net/wards/434/chat/messages
```

응답:

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버에 오류가 발생하였습니다.",
  "messageKey": "error.internalServerError",
  "displayPolicy": "CLIENT_TRANSLATE",
  "locale": "ko-KR",
  "requestId": "7b6e967d"
}
```

프론트는 병동톡 전송 실패 toast만 표시하고 있으며, 서버 공통 에러가 그대로 내려오고 있습니다. 백엔드 로그에서 `requestId=7b6e967d` 기준으로 실제 예외 원인 확인이 필요합니다.

## 재현 상황

1. dev 웹 앱에서 `wardId=434` 병동 화면 진입
2. 병동톡 위젯 열기
3. 메시지 입력 후 전송
4. `POST /wards/434/chat/messages`가 500 반환

브라우저 네트워크 정보:

```text
Request URL: https://dev.api.dutying.net/wards/434/chat/messages
Request Method: POST
Status Code: 500 Internal Server Error
Remote Address: 3.36.210.125:443
Referrer Policy: strict-origin-when-cross-origin
```

## 프론트 요청 형식

프론트는 JSON body로 메시지를 전송합니다.

```http
POST /wards/{wardId}/chat/messages
Content-Type: application/json
Authorization: Bearer {accessToken}
```

요청 body 타입:

```ts
type TCreateWardChatMessageDTO = {
  text: string;
  clientMessageId: string;
};
```

실제 body 예시:

```json
{
  "text": "hello",
  "clientMessageId": "6f8b4e54-4e7e-4c18-8df7-2b9f7c8d7f5d"
}
```

`clientMessageId`는 브라우저에서 `crypto.randomUUID()`로 생성하며, 지원하지 않는 환경에서는 `Date.now()`와 random string 조합으로 생성합니다.

관련 프론트 코드:

```text
packages/api/src/ward/create-ward-api.ts
packages/api/src/ward/contracts.ts
apps/app/src/widgets/ward-chat/index.tsx
packages/api/src/__tests__/index.test.ts
```

현재 API client는 아래처럼 호출합니다.

```ts
client.post(`/wards/${wardId}/chat/messages`, {
  text,
  clientMessageId,
});
```

단위 테스트에서도 같은 endpoint와 body를 검증하고 있습니다.

```ts
expect(postMock).toHaveBeenCalledWith('/wards/7/chat/messages', {
  text: 'hello',
  clientMessageId: 'client-1',
});
```

## 기대 응답

메시지 전송 성공 시 프론트는 아래 형태의 응답을 기대합니다.

```ts
type TWardChatMessageResponse = {
  messageId: number;
  moimId: number;
  wardId: number;
  senderAccountId: number;
  senderName: string;
  text: string;
  sentAt: string;
  isDeleted: boolean;
};
```

예상 동작:

1. 서버가 메시지를 저장합니다.
2. 생성된 메시지 객체를 응답으로 내려줍니다.
3. 프론트가 응답 메시지를 병동톡 목록에 즉시 추가합니다.
4. 이후 메시지 목록 query를 invalidate해서 서버 상태와 동기화합니다.

## 실제 동작

서버가 500을 반환하여 메시지가 전송되지 않습니다.

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버에 오류가 발생하였습니다.",
  "messageKey": "error.internalServerError",
  "displayPolicy": "CLIENT_TRANSLATE",
  "locale": "ko-KR",
  "requestId": "7b6e967d"
}
```

프론트 사용자에게는 아래 toast가 표시됩니다.

```text
메시지를 보내지 못했어요.
```

## 백엔드 확인 요청

아래 항목 확인 부탁드립니다.

1. `requestId=7b6e967d` 서버 로그의 stack trace와 root cause
2. `wardId=434`에 병동톡 room 또는 `moim` 데이터가 정상 생성되어 있는지
3. 현재 로그인 계정이 `wardId=434`에 메시지를 보낼 수 있는 ACTIVE 소속인지
4. 서버 DTO가 `text`, `clientMessageId` 필드를 받도록 되어 있는지
5. `clientMessageId` 중복 처리 또는 unique constraint 처리 중 예외가 발생하는지
6. 메시지 저장 시 `sender_account_id`, `ward_id`, `moim_id` 등 FK 제약 조건 위반이 있는지
7. 관리자 계정 토큰으로 전송한 경우, 일반 계정과 관리자 계정의 sender 저장 방식이 모두 지원되는지

## 유력한 원인 후보

현재 프론트 요청 형식은 API client와 테스트 기준으로 `{ text, clientMessageId }` JSON body입니다. 400이 아니라 500이 발생하므로, 단순 validation 실패보다는 서버 내부 저장 과정 또는 연관 데이터 조회 과정에서 예외가 발생했을 가능성이 큽니다.

특히 아래 케이스를 우선 확인하면 좋겠습니다.

```text
wardId=434에 연결된 chat room/moim row가 없음
메시지 sender로 저장할 account row를 찾지 못함
관리자 계정 principal과 일반 account FK가 불일치함
clientMessageId unique/idempotency 처리 중 중복 또는 null 관련 예외 발생
ward membership 권한 확인 이후 메시지 저장 단계에서 FK 제약 위반 발생
```

## 요청 방향

백엔드에서 아래 중 실제 원인에 맞게 처리 부탁드립니다.

1. `wardId=434` 병동톡 room/moim 누락이면 병동 생성 또는 병동톡 첫 접근 시 자동 생성되도록 보정
2. 권한 또는 소속 문제라면 500 대신 명확한 403/404 응답과 messageKey 반환
3. 요청 body 계약 불일치라면 프론트가 맞출 수 있도록 정확한 DTO 필드명 공유
4. FK 또는 저장 예외라면 데이터 보정 및 저장 로직 방어 처리
5. 관리자 계정 전송 미지원 상태라면 관리자 계정용 sender 처리 방식 또는 대체 API 계약 공유

## 추가로 필요한 정보

문제 재현 계정과 실제 전송 body 값은 현재 캡처에 포함되어 있지 않습니다. 백엔드 로그 확인 후 필요하면 프론트에서 아래 정보를 추가로 전달하겠습니다.

```text
로그인 계정 ID / 계정 유형
wardId=434 소속 상태
실제 message text
실제 clientMessageId
요청 발생 시각
Authorization 토큰의 principal type
```
