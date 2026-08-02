# 채팅 메시지 푸시 알림 앱 싱크 문서

- 작성일: 2026-08-02
- 대상: 앱 개발자
- 범위: 병동톡/모임톡 FCM push 수신, 클릭 라우팅, foreground 표시 정책, 알림 설정 UI
- 서버 구현 상태: 1차 구현 완료

## 결론

병동톡/모임톡은 메신저 성격의 기능이므로 앱이 백그라운드/종료 상태일 때 OS 푸시가 와야 합니다.

서버 1차 정책은 아래와 같습니다.

- 채팅 메시지 저장은 기존 chat message API가 담당합니다.
- 실시간 화면 갱신은 기존 SSE `WARD_CHAT_MESSAGE_CREATED`, `MOIM_CHAT_MESSAGE_CREATED`가 계속 담당합니다.
- 휴대폰 OS 푸시는 신규 chat FCM pipeline이 담당합니다.
- 채팅 메시지는 일반 알림함 `/notifications` row를 만들지 않습니다.
- 채팅 unread는 기존 채팅 unread API/SSE payload 기준으로 유지합니다.

앱은 채팅 푸시를 일반 알림함 알림처럼 처리하지 말고, 채팅방 이동과 채팅 unread 갱신 흐름으로 처리해야 합니다.

## 이벤트 계약

| 이벤트 | classification | domain | sourceType | sourceId | url | notificationId |
| --- | --- | --- | --- | --- | --- | --- |
| 병동톡 메시지 | `WARD_CHAT_MESSAGE` | `CHAT` | `WARD_CHAT` | wardId | `/ward/chat?wardId={wardId}&messageId={messageId}` | 없음 |
| 모임톡 메시지 | `MOIM_CHAT_MESSAGE` | `CHAT` | `MOIM_CHAT` | moimId | `/moim/{moimId}?tab=chat&messageId={messageId}` | 없음 |

`notificationId`가 없는 것이 정상입니다. 서버가 `/notifications` row를 만들지 않기 때문입니다.

## FCM Data Payload

FCM `data` 값은 모두 string으로 내려옵니다.

### 병동톡

```json
{
  "classification": "WARD_CHAT_MESSAGE",
  "domain": "CHAT",
  "sourceType": "WARD_CHAT",
  "sourceId": "10",
  "url": "/ward/chat?wardId=10&messageId=9876",
  "chatType": "WARD",
  "roomId": "10",
  "wardId": "10",
  "messageId": "9876",
  "senderAccountId": "123",
  "senderName": "김듀팅",
  "unreadCount": "4"
}
```

### 모임톡

```json
{
  "classification": "MOIM_CHAT_MESSAGE",
  "domain": "CHAT",
  "sourceType": "MOIM_CHAT",
  "sourceId": "55",
  "url": "/moim/55?tab=chat&messageId=9876",
  "chatType": "MOIM",
  "roomId": "55",
  "moimId": "55",
  "messageId": "9876",
  "senderAccountId": "123",
  "senderName": "김듀팅",
  "unreadCount": "2"
}
```

### Sender Field 주의

일반 계정이 보낸 메시지는 `senderAccountId`가 포함됩니다.

병동 관리자 발신 병동톡은 `senderAccountId`가 없을 수 있고, 이 경우 `senderWardAdminAccountId`가 포함될 수 있습니다. 앱은 `senderAccountId`가 항상 존재한다고 가정하지 않아야 합니다.

## FCM Notification 문구

| 항목 | 병동톡 | 모임톡 |
| --- | --- | --- |
| title | `{wardName} 병동톡` | `{moimName}` |
| 텍스트 있음 body | `{senderName}: {text}` | `{senderName}: {text}` |
| 사진만 있음 body | `{senderName}: 사진을 보냈습니다.` | `{senderName}: 사진을 보냈습니다.` |

추가 정책:

- 텍스트와 사진이 함께 있으면 body는 `{senderName}: {text}`입니다.
- body는 서버에서 약 80자 기준으로 말줄임 처리됩니다.
- 삭제된 메시지는 서버가 푸시를 보내지 않습니다.

## 앱 처리 기준

### 백그라운드/종료 상태에서 푸시 클릭

1. FCM data의 `url`을 우선 파싱합니다.
2. `classification=WARD_CHAT_MESSAGE`면 병동톡 화면으로 이동합니다.
3. `classification=MOIM_CHAT_MESSAGE`면 해당 모임톡 화면으로 이동합니다.
4. `messageId`가 있으면 해당 메시지로 스크롤/하이라이트를 best effort로 처리합니다.
5. 화면 진입 후 메시지 목록과 unread count를 재조회합니다.
6. 채팅방 진입 후 기존 read 처리 API를 호출합니다.

### Foreground 상태에서 푸시 수신

서버는 앱의 foreground/background 상태를 알 수 없으므로 조건에 맞으면 FCM을 보냅니다. foreground 표시 억제는 앱에서 처리해야 합니다.

| 현재 앱 화면 | 권장 처리 |
| --- | --- |
| 같은 병동톡/모임톡 방을 보고 있음 | OS/local 알림 표시 안 함, SSE 또는 메시지 refresh로 화면만 갱신 |
| 다른 채팅방을 보고 있음 | 앱 내 배너 또는 local notification 표시 |
| 채팅이 아닌 다른 화면 | 앱 내 배너 또는 local notification 표시 |

같은 방 판단 기준:

- `chatType=WARD`이고 현재 열린 병동톡의 `wardId`가 data의 `wardId`와 같으면 같은 방입니다.
- `chatType=MOIM`이고 현재 열린 모임톡의 `moimId`가 data의 `moimId`와 같으면 같은 방입니다.

## 일반 알림함과의 차이

채팅 푸시는 `/notifications` row가 없으므로 아래를 하지 않습니다.

- `/notifications/{notificationId}/read` 호출하지 않음
- `/notifications/{notificationId}/push-open` 호출하지 않음
- 일반 알림함 unread count를 직접 증가시키지 않음
- 홈 알림함 목록에 채팅 메시지를 추가하지 않음

대신 아래를 수행합니다.

- 병동톡 unread count 갱신
- 모임톡 unread count 갱신
- 필요한 경우 병동/소셜 탭 배지를 채팅 unread API/SSE 기준으로 갱신
- 해당 채팅방 진입 시 read 처리 API 호출

## 딥링크/라우팅 요구사항

앱은 아래 경로를 처리해야 합니다.

### 병동톡

```text
/ward/chat?wardId={wardId}&messageId={messageId}
```

권장 이동:

- 홈 > 병동 탭 진입
- 병동톡 room open
- 메시지 목록 refresh
- `messageId` 위치로 이동 가능하면 이동

### 모임톡

```text
/moim/{moimId}?tab=chat&messageId={messageId}
```

권장 이동:

- 소셜 또는 모임 상세 진입
- 모임톡 tab open
- 메시지 목록 refresh
- `messageId` 위치로 이동 가능하면 이동

## 알림 설정 UI

서버는 신규 설정 필드를 추가했습니다.

| 필드 | 기본값 | OFF 시 | 앱 문구 제안 |
| --- | ---: | --- | --- |
| `wardChatMessagePush` | true | 병동톡 메시지 FCM 발송 안 함 | 병동톡 메시지 푸시 알림 |
| `moimChatMessagePush` | true | 모임톡 메시지 FCM 발송 안 함 | 모임톡 메시지 푸시 알림 |

`GET /accounts/me/notification-settings` 응답의 `settings` 안에 위 필드가 포함됩니다.

```json
{
  "settings": {
    "wardChatMessagePush": true,
    "moimChatMessagePush": true
  },
  "updatedAt": "2026-08-02T12:00:00"
}
```

`PATCH /accounts/me/notification-settings`는 partial update를 지원합니다.

```json
{
  "wardChatMessagePush": false
}
```

앱 UI 반영 전까지는 서버 기본값 true로 동작합니다. 앱 설정 화면에 반영할 때는 일반 알림함 기록까지 끄는 설정처럼 보이지 않도록 "푸시 알림" 표현을 사용합니다.

## 기존 알림 정책과의 관계

기존 일반 알림 정책:

- `marketingPush=false`: `/notifications` row와 FCM 모두 제외
- 나머지 업무/소셜/커뮤니티 토글 OFF: row 생성, FCM만 제외

채팅 푸시 1차 정책:

- `/notifications` row 자체를 만들지 않음
- 채팅 메시지 저장과 unread는 채팅 시스템이 담당
- `wardChatMessagePush=false`, `moimChatMessagePush=false`: FCM만 제외
- SSE는 설정과 무관하게 유지

## 채팅 알림 구현 가이드

### 1. Push Type 분리

앱 내부에서 일반 알림 push와 채팅 push를 먼저 분리합니다.

권장 분기:

```text
classification == WARD_CHAT_MESSAGE || classification == MOIM_CHAT_MESSAGE
  -> ChatPushHandler
else
  -> ExistingNotificationPushHandler
```

채팅 push handler는 `notificationId` 존재를 요구하면 안 됩니다.

### 2. Data Parsing

모든 data 값은 string입니다. 앱에서 숫자로 써야 하는 값만 안전하게 parse합니다.

필수 취급 권장 필드:

- `classification`
- `url`
- `chatType`
- `messageId`
- `wardId` 또는 `moimId`

표시/로깅용 필드:

- `senderAccountId`
- `senderWardAdminAccountId`
- `senderName`
- `unreadCount`

### 3. Click Routing

클릭 시에는 `url`을 우선 사용합니다. 다만 앱 라우터에서 `url` 파싱이 실패할 경우를 대비해 `chatType`, `wardId`, `moimId`, `messageId` fallback도 둡니다.

권장 fallback:

```text
if chatType == WARD:
  openWardChat(wardId, messageId)
if chatType == MOIM:
  openMoimChat(moimId, messageId)
```

### 4. Message Refresh

채팅 push 클릭으로 방에 들어간 뒤에는 push payload만 신뢰하지 말고 서버에서 메시지 목록을 다시 조회합니다.

권장 순서:

1. 채팅방 화면 open
2. 메시지 목록 refresh
3. unread count refresh
4. `messageId`가 목록에 있으면 scroll/highlight
5. 기존 read API 호출

### 5. Foreground 중복 표시 방지

앱이 같은 채팅방을 보고 있을 때 local notification을 띄우면 사용자가 같은 메시지를 이중으로 보게 됩니다.

권장 정책:

- 같은 방: local notification 표시 안 함
- 다른 방: 앱 내 배너 또는 local notification 표시
- 기타 화면: 앱 내 배너 또는 local notification 표시

### 6. Badge/Unread 갱신

채팅 unread는 일반 알림 unread와 분리합니다.

- 일반 알림 배지: `/notifications/unread-count`
- 채팅 배지: 채팅 unread API/SSE payload

채팅 push 수신 시 `data.unreadCount`는 빠른 UI 힌트로 사용할 수 있지만, 최종 상태는 채팅 unread API로 보정하는 것을 권장합니다.

### 7. Backward Compatibility

기존 앱이 신규 설정 필드를 모르는 상태여도 깨지지 않아야 합니다.

- 설정 GET 응답에 모르는 필드가 있어도 무시
- 설정 PATCH는 변경하려는 필드만 보내기
- 채팅 push에 `notificationId`가 없어도 오류 처리하지 않기
- 병동 관리자 발신 메시지에서 `senderAccountId`가 없을 수 있음을 허용

## 앱 구현 체크리스트

- [ ] `WARD_CHAT_MESSAGE` FCM data를 파싱한다.
- [ ] `MOIM_CHAT_MESSAGE` FCM data를 파싱한다.
- [ ] `notificationId`가 없는 push open을 허용한다.
- [ ] 채팅 push open 시 `/notifications/{id}/push-open`을 호출하지 않는다.
- [ ] `/ward/chat?wardId=...&messageId=...` 경로를 병동톡 화면으로 연결한다.
- [ ] `/moim/{moimId}?tab=chat&messageId=...` 경로를 모임톡 화면으로 연결한다.
- [ ] 채팅 화면 진입 후 메시지 목록과 unread count를 refresh한다.
- [ ] 현재 같은 채팅방을 보고 있으면 foreground local notification을 띄우지 않는다.
- [ ] 다른 화면이면 앱 내 배너 또는 local notification을 띄운다.
- [ ] 설정 API에 `wardChatMessagePush`, `moimChatMessagePush`가 추가되어도 기존 앱이 깨지지 않게 파싱한다.
- [ ] 앱 설정 화면에 신규 토글을 추가할 경우 "푸시 알림" 문구를 사용한다.
- [ ] 병동 관리자 발신 메시지의 `senderAccountId=null` 가능성을 허용한다.

## QA 시나리오

### 병동톡

1. A와 B가 같은 병동에 소속되어 있다.
2. B 기기에서 앱 알림 권한을 허용하고 로그인한다.
3. B의 `wardChatMessagePush=true` 상태를 확인한다.
4. A가 병동톡 메시지를 보낸다.
5. B 앱이 백그라운드/종료 상태이면 OS 푸시가 온다.
6. B가 푸시를 누르면 병동톡 화면으로 이동한다.
7. 메시지 목록과 unread count가 최신화된다.
8. A 본인에게는 푸시가 오지 않는다.
9. B가 같은 병동톡 방을 보고 있는 foreground 상태라면 local notification이 뜨지 않는다.

### 모임톡

1. A와 B가 같은 모임에 소속되어 있다.
2. B 기기에서 앱 알림 권한을 허용하고 로그인한다.
3. B의 `moimChatMessagePush=true` 상태를 확인한다.
4. A가 모임톡 메시지를 보낸다.
5. B 앱이 백그라운드/종료 상태이면 OS 푸시가 온다.
6. B가 푸시를 누르면 해당 모임톡 화면으로 이동한다.
7. 메시지 목록과 unread count가 최신화된다.
8. A 본인에게는 푸시가 오지 않는다.
9. 사진만 있는 메시지는 `사진을 보냈습니다.` 문구로 표시된다.

### 설정 OFF

1. B가 `wardChatMessagePush=false`로 변경한다.
2. A가 병동톡 메시지를 보낸다.
3. B에게 병동톡 FCM이 오지 않는다.
4. B가 앱을 열면 SSE 또는 채팅 API 기준으로 메시지와 unread는 정상 반영된다.
5. `/notifications` 목록에는 해당 채팅 메시지가 생기지 않는다.

## 후속 범위

1차 구현 이후 필요하면 아래를 추가 검토합니다.

- 채팅방별 알림 끄기
- 방해금지 시간
- mention 전용 푸시
- 앱 아이콘 badge에 채팅 unread count 포함
- 웹 브라우저 push 지원
