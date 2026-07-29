# 병동톡/모임톡 사진 전송 앱 연동 요청

작성일: 2026-07-27

## 서버 변경 요약

병동톡/모임톡 메시지 생성, 목록 조회, 실시간 이벤트에 `imageUrls`가 추가됩니다.

텍스트만 보내던 기존 요청은 그대로 동작합니다. 사진만 보내는 경우 `text`는 생략하거나 빈 문자열로 보내고, `imageUrls`에 업로드된 이미지 URL을 넣어 주세요.

## 이미지 업로드 흐름

1. Presigned URL 발급

```http
POST /files/presigned-url
Content-Type: application/json

{
  "fileType": "CHAT_IMAGE",
  "fileExtension": "jpg"
}
```

2. 응답의 `presignedUrl`로 이미지 파일을 업로드합니다.
3. 업로드 성공 후 응답의 `fileUrl`을 채팅 메시지 생성 요청의 `imageUrls`에 넣습니다.

## 병동톡 메시지 전송

```http
POST /wards/{wardId}/chat/messages
Content-Type: application/json

{
  "text": "확인 부탁드려요",
  "imageUrls": [
    "https://cdn.example.com/chat_img/chat_....jpg"
  ],
  "clientMessageId": "client-generated-id"
}
```

사진만 보내는 예시:

```json
{
  "imageUrls": [
    "https://cdn.example.com/chat_img/chat_....jpg"
  ],
  "clientMessageId": "client-generated-id"
}
```

## 모임톡 메시지 전송

```http
POST /moims/{moimId}/chat/messages
Content-Type: application/json

{
  "text": "사진 공유해요",
  "imageUrls": [
    "https://cdn.example.com/chat_img/chat_....jpg"
  ],
  "clientMessageId": "client-generated-id"
}
```

## 응답 필드

메시지 목록 조회, 메시지 생성 응답, SSE 실시간 이벤트 payload 모두 아래 필드를 포함합니다.

```json
{
  "messageId": 123,
  "moimId": null,
  "wardId": 456,
  "senderAccountId": 10,
  "senderWardAdminAccountId": null,
  "senderType": "ACCOUNT",
  "senderName": "홍길동",
  "senderProfileImgUrl": "https://...",
  "text": "",
  "imageUrls": [
    "https://cdn.example.com/chat_img/chat_....jpg"
  ],
  "sentAt": "2026-07-27T12:34:56",
  "isDeleted": false
}
```

삭제된 메시지는 기존처럼 `text`가 빈 문자열로 내려가며, `imageUrls`도 빈 배열로 내려갑니다.

## 제한사항

- 텍스트 또는 이미지 중 하나는 반드시 포함해야 합니다.
- `text` 최대 1000자
- `imageUrls` 최대 5장
- 이미지 URL 하나당 최대 2048자
- 기존 중복 전송 방지 정책은 `clientMessageId` 기준으로 그대로 유지됩니다.

## 앱 UI 요청

- 채팅 입력창에 사진 선택 버튼을 추가해 주세요.
- 업로드 중에는 전송 버튼을 비활성화하거나 업로드 상태를 표시해 주세요.
- 이미지 메시지는 말풍선 안에서 썸네일로 표시하고, 탭하면 원본 URL을 확대/미리보기로 열어 주세요.
- 텍스트와 이미지가 함께 있는 메시지는 이미지 목록 아래 또는 위에 텍스트를 함께 표시해 주세요.
- SSE 이벤트 수신 시 `imageUrls`가 있으면 새 메시지 프리뷰 문구는 `사진을 보냈습니다.`처럼 노출해 주세요.
