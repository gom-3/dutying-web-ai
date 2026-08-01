# 채팅 메시지 안읽은 멤버 수 앱 반영 요청

## 배경

병동챗/모임챗 메시지 말풍선 옆에 일반 메신저처럼 숫자를 표시하려고 합니다.

이 숫자는 "읽은 사람 수"가 아니라 "아직 안 읽은 수신자 수"입니다.

예시: 6명 방에서 내가 메시지를 보내면 처음에는 `5`, 한 명이 읽으면 `4`, 모두 읽으면 숫자를 숨깁니다.

## 서버 변경 사항

채팅 메시지 응답에 `unreadMemberCount` 필드가 추가됩니다.

대상 응답:

- `GET /wards/{wardId}/chat/messages`
- `POST /wards/{wardId}/chat/messages`
- `GET /moims/{moimId}/chat/messages`
- `POST /moims/{moimId}/chat/messages`
- 채팅 메시지 생성 SSE payload

응답 예시:

```json
{
  "messageId": 123,
  "moimId": null,
  "wardId": 434,
  "senderAccountId": 10,
  "senderWardAdminAccountId": null,
  "senderType": "ACCOUNT",
  "senderName": "김듀팅",
  "senderProfileImgUrl": null,
  "text": "확인 부탁드려요",
  "imageUrls": [],
  "sentAt": "2026-08-01T10:30:00",
  "isDeleted": false,
  "unreadMemberCount": 3
}
```

## 필드 의미

`unreadMemberCount`는 현재 방 멤버 중 해당 메시지를 아직 읽지 않은 수신자 수입니다.

계산 기준:

- 메시지 작성자는 수신자에서 제외합니다.
- `lastReadMessageId >= messageId`인 멤버는 읽은 것으로 봅니다.
- read cursor가 없거나 `lastReadMessageId < messageId`이면 안 읽은 것으로 봅니다.
- 병동챗은 현재 연결된 간호사 계정과 active 병동 관리자 계정을 기준으로 계산합니다.
- 모임챗은 현재 모임 멤버를 기준으로 계산합니다.
- 현재 멤버 기준이므로, 과거에 나간 멤버까지 고정 스냅샷으로 계산하지는 않습니다.

## 앱 표시 정책

앱에서는 내가 보낸 메시지에만 `unreadMemberCount`를 표시해 주세요.

권장 표시:

- `unreadMemberCount > 0`: 말풍선 옆 시간 근처에 숫자 표시
- `unreadMemberCount === 0`: 숫자 숨김
- 값이 없거나 `null`: 구버전 서버/캐시 호환을 위해 0처럼 처리
- 너무 큰 값은 앱 정책에 따라 `99+`로 축약 가능

내 메시지 판단:

- 일반 계정: `message.senderAccountId === myAccountId`
- 병동 관리자: `message.senderWardAdminAccountId === myWardAdminAccountId`

## 갱신 방식

현재 서버는 메시지별 read-update 이벤트를 별도로 보내지 않습니다.

따라서 숫자는 아래 시점에 갱신됩니다.

- 채팅방 진입 후 `GET .../chat/messages` 조회
- 채팅방이 열려 있는 동안 앱에서 메시지 목록 재조회/폴링
- 내가 메시지를 보낸 직후 `POST .../chat/messages` 응답
- 새 메시지 생성 SSE payload 수신

다른 사용자가 읽는 순간 숫자가 즉시 줄어드는 UX가 꼭 필요하면, 별도 read-update SSE 이벤트가 추가로 필요합니다.

## 호환성

DB 마이그레이션은 없습니다.

기존 클라이언트는 새 필드를 무시하면 그대로 동작합니다.
