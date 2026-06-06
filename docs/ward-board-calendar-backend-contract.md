# 백엔드 요청: 병동 게시판 캘린더 일정 필드 확장

첨부된 현재 OpenAPI 기준으로, 병동 게시판 캘린더 일정 API의 기본 CRUD는 이미 구현되어 있습니다.  
따라서 아래 요청에서는 이미 구현된 엔드포인트 생성 요청은 제외하고, 일반적인 캘린더 UX에 필요한 누락 필드와 저장/조회 동작만 정리합니다.

## 현재 구현 확인되어 요청에서 제외할 내용

이미 구현된 것으로 확인된 항목입니다.

- `GET /wards/{wardId}/board/schedules`
  - `startDate`, `endDate` query로 목록 조회
  - 응답: `WardBoardScheduleResDto[]`
- `POST /wards/{wardId}/board/schedules`
  - 응답: `201 Created`
  - 응답 body: `WardBoardScheduleResDto`
- `PUT /wards/{wardId}/board/schedules/{scheduleId}`
  - 응답 body: `WardBoardScheduleResDto`
- `DELETE /wards/{wardId}/board/schedules/{scheduleId}`
  - 응답: `204 No Content`
- 응답에 아래 메타 필드가 존재
  - `scheduleId`, `id`
  - `writerName`, `authorName`
  - `createdAt`, `modifiedAt`
  - `isMine`, `editableByMe`, `deletableByMe`
  - `sourceType`, `sourcePostId`

현재 `Create`, `Update`, `WardBoardScheduleResDto`에는 아래 필드만 확인됩니다.

- `title`
- `content`
- `scheduleDate`
- `startTime`
- `endTime`

## 요청 1. 게시판 캘린더 일정에도 일반 캘린더 필드 추가

`Ward Board Schedule API`의 생성/수정 요청과 응답 DTO에 아래 필드를 추가해 주세요.

```json
{
  "startDate": "2026-06-06",
  "endDate": "2026-06-08",
  "isAllDay": true
}
```

### 필드 의미

- `startDate`: 일정 시작 날짜 (`YYYY-MM-DD`)
- `endDate`: 일정 종료 날짜 (`YYYY-MM-DD`)
- `isAllDay`: 종일 일정 여부

현재 앱의 개인/계정 캘린더 API에는 `startDate`, `endDate`, `isAllDay`가 이미 있는 것으로 보입니다. 병동 게시판 캘린더 일정도 같은 필드 의미로 맞춰주시면 됩니다.

### 호환 처리

현재 웹 프론트는 호환을 위해 `allDay`와 `isAllDay`를 함께 보내고 있습니다.

백엔드는 가능하면 아래 둘 중 하나를 지원해 주세요.

- 권장: `isAllDay`를 정식 필드로 사용
- 호환: `allDay`가 들어와도 `isAllDay`와 같은 의미로 처리

응답에는 최소한 `isAllDay`를 내려주세요.

## 요청 2. 종일 일정 저장/수정 규칙

종일 일정 요청 예시입니다.

```json
{
  "title": "신규 교육",
  "content": "온라인 교육",
  "scheduleDate": "2026-06-06",
  "startDate": "2026-06-06",
  "endDate": "2026-06-08",
  "isAllDay": true,
  "allDay": true,
  "startTime": null,
  "endTime": null
}
```

요청 사항:

- `isAllDay=true`이면 `startTime`, `endTime`은 없어야 하거나 `null`로 저장되어야 합니다.
- 기존 시간 일정이 종일 일정으로 수정될 때 `startTime/endTime: null`을 기존 시간 삭제로 처리해야 합니다.
- 수정 후 다시 조회했을 때 응답에 `isAllDay: true`가 반드시 포함되어야 합니다.

현재 문제로 보이는 지점:

- 프론트에서 종일 체크 후 저장/수정해도, 다시 수정 모달을 열면 종일 체크가 빠져 보입니다.
- 프론트는 저장 후 목록 재조회 응답을 기준으로 수정 모달 상태를 만듭니다.
- 따라서 조회 응답에 `isAllDay` 값이 없거나 `false`로 내려오면 종일 저장이 안 된 것처럼 보입니다.

## 요청 3. 시간 일정 저장/수정 규칙

시간 일정 요청 예시입니다.

```json
{
  "title": "인수인계",
  "content": "",
  "scheduleDate": "2026-06-06",
  "startDate": "2026-06-06",
  "endDate": "2026-06-06",
  "isAllDay": false,
  "allDay": false,
  "startTime": "09:00",
  "endTime": "10:00"
}
```

요청 사항:

- `isAllDay=false`이면 `startTime`, `endTime`을 저장하고 응답에도 그대로 내려주세요.
- 같은 날짜 일정은 `endTime`이 `startTime`보다 늦어야 합니다.
- 여러 날 시간 일정은 `startDate + startTime`부터 `endDate + endTime`까지 이어지는 일정으로 봐주세요.

## 요청 4. 여러 날 일정 조회 규칙

`GET /wards/{wardId}/board/schedules?startDate=...&endDate=...`는 조회 범위와 겹치는 일정을 모두 내려줘야 합니다.

예시:

- 일정 기간: `2026-06-30` ~ `2026-07-02`
- 6월 조회: `startDate=2026-06-01&endDate=2026-06-30`
- 7월 조회: `startDate=2026-07-01&endDate=2026-07-31`

위 일정은 6월 조회와 7월 조회 양쪽에 모두 포함되어야 합니다.

## 요청 5. 응답 DTO 예시

종일 여러 날 일정 응답 예시:

```json
{
  "scheduleId": 1,
  "id": 1,
  "title": "신규 교육",
  "content": "온라인 교육",
  "scheduleDate": "2026-06-06",
  "startDate": "2026-06-06",
  "endDate": "2026-06-08",
  "isAllDay": true,
  "startTime": null,
  "endTime": null,
  "writerName": "홍길동",
  "authorName": "홍길동",
  "createdAt": "2026-06-06T09:00:00",
  "modifiedAt": "2026-06-06T09:00:00",
  "isMine": true,
  "editableByMe": true,
  "deletableByMe": true,
  "sourceType": "MANUAL",
  "sourcePostId": null
}
```

시간 일정 응답 예시:

```json
{
  "scheduleId": 2,
  "title": "인수인계",
  "content": "",
  "scheduleDate": "2026-06-06",
  "startDate": "2026-06-06",
  "endDate": "2026-06-06",
  "isAllDay": false,
  "startTime": "09:00",
  "endTime": "10:00",
  "editableByMe": true,
  "deletableByMe": true,
  "sourceType": "MANUAL",
  "sourcePostId": null
}
```

## 프론트에서 현재 보완해둔 내용

프론트는 백엔드 호환을 위해 아래 방어 처리를 해두었습니다.

- 요청 시 `allDay`와 `isAllDay`를 함께 전송
- 종일 일정이면 `startTime/endTime`을 `null`로 전송
- 응답에서 `allDay`, `isAllDay`, `all_day`, `is_all_day`를 모두 종일 값으로 인식
- 응답 값이 `true`, `"true"`, `1`, `"1"`이어도 종일로 인식
- `start_time/end_time`, `start_date/end_date` 같은 snake_case 응답도 인식

다만 백엔드가 실제 저장/조회 응답에 종일 값을 아예 내려주지 않으면, 프론트에서 수정 모달의 종일 체크를 복원할 수 없습니다.  
따라서 `isAllDay` 저장과 조회 응답 포함은 반드시 필요합니다.
