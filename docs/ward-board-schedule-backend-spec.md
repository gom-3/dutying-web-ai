# 병동 캘린더 일정 백엔드 구현 요청

## 배경

웹 게시판의 우측 `병동 캘린더`에서 게시글 마감뿐 아니라 병동 공용 일정을 등록/수정/삭제하고, 같은 병동에 연결된 모든 간호사가 앱의 병동 캘린더에서 볼 수 있어야 합니다.

현재 프론트는 아래 API를 호출하고 있으나 백엔드에 라우트가 없어 `404 Not Found`가 발생합니다.

```txt
GET https://dev.api.dutying.net/wards/278/board/schedules?startDate=2026-05-01&endDate=2026-05-31

Response:
{
  "timestamp": "2026-06-01T09:29:55.394+00:00",
  "status": 404,
  "error": "Not Found",
  "path": "/wards/278/board/schedules"
}
```

일정이 없는 경우에는 `404`가 아니라 `200 OK`와 빈 배열 `[]`을 반환해야 합니다.

## 필요한 API

```txt
GET    /wards/{wardId}/board/schedules?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
POST   /wards/{wardId}/board/schedules
PUT    /wards/{wardId}/board/schedules/{scheduleId}
DELETE /wards/{wardId}/board/schedules/{scheduleId}
```

## 데이터 모델

예시 테이블명: `ward_board_schedule`

```txt
id
ward_id
title
content nullable
schedule_date
start_time nullable
end_time nullable
writer_account_id
created_at
modified_at
deleted_at nullable
```

`deleted_at`은 소프트 삭제 정책을 쓸 경우에만 필요합니다.

## 공통 응답 DTO

프론트는 `scheduleId` 또는 `id` 둘 다 처리할 수 있지만, 일관성을 위해 `scheduleId` 권장합니다.

```json
{
  "scheduleId": 1,
  "title": "신규 교육",
  "content": "3층 교육실",
  "scheduleDate": "2026-05-12",
  "startTime": "14:00",
  "endTime": "15:00",
  "writerName": "홍길동",
  "authorName": "홍길동",
  "createdAt": "2026-06-01T09:00:00Z",
  "modifiedAt": "2026-06-01T09:00:00Z",
  "isMine": true
}
```

필드 설명:

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `scheduleId` | number | 권장 | 일정 ID |
| `id` | number | 선택 | `scheduleId` 대신 사용 가능 |
| `title` | string | 필수 | 일정 제목 |
| `content` | string | 선택 | 일정 메모 |
| `scheduleDate` | string | 필수 | `YYYY-MM-DD` |
| `startTime` | string | 선택 | `HH:mm` |
| `endTime` | string | 선택 | `HH:mm` |
| `writerName` | string | 선택 | 작성자 이름 |
| `authorName` | string | 선택 | 작성자 이름, `writerName` 대체 가능 |
| `createdAt` | string | 선택 | 생성 시각 |
| `modifiedAt` | string | 선택 | 수정 시각 |
| `isMine` | boolean | 선택 | 현재 로그인 사용자가 작성자인지 여부 |

## GET 일정 목록

```txt
GET /wards/{wardId}/board/schedules?startDate=2026-05-01&endDate=2026-05-31
```

조회 조건:

```txt
ward_id = {wardId}
startDate <= schedule_date <= endDate
deleted_at is null
```

성공 응답:

```json
[
  {
    "scheduleId": 1,
    "title": "신규 교육",
    "content": "3층 교육실",
    "scheduleDate": "2026-05-12",
    "startTime": "14:00",
    "endTime": "15:00",
    "writerName": "홍길동",
    "isMine": true,
    "createdAt": "2026-06-01T09:00:00Z",
    "modifiedAt": "2026-06-01T09:00:00Z"
  }
]
```

일정이 없는 경우:

```json
[]
```

프론트는 배열 외에도 아래 형태까지 허용해두었습니다.

```json
{
  "schedules": []
}
```

```json
{
  "items": []
}
```

```json
{
  "data": []
}
```

다만 백엔드 표준이 없다면 배열 응답을 권장합니다.

## POST 일정 등록

```txt
POST /wards/{wardId}/board/schedules
```

Request body:

```json
{
  "title": "신규 교육",
  "content": "3층 교육실",
  "scheduleDate": "2026-05-12",
  "startTime": "14:00",
  "endTime": "15:00"
}
```

Response:

```txt
201 Created
```

```json
{
  "scheduleId": 1,
  "title": "신규 교육",
  "content": "3층 교육실",
  "scheduleDate": "2026-05-12",
  "startTime": "14:00",
  "endTime": "15:00",
  "writerName": "홍길동",
  "isMine": true,
  "createdAt": "2026-06-01T09:00:00Z",
  "modifiedAt": "2026-06-01T09:00:00Z"
}
```

## PUT 일정 수정

```txt
PUT /wards/{wardId}/board/schedules/{scheduleId}
```

Request body:

```json
{
  "title": "신규 교육 변경",
  "content": "장소 변경: 5층 교육실",
  "scheduleDate": "2026-05-13",
  "startTime": "15:00",
  "endTime": "16:00"
}
```

Response:

```txt
200 OK
```

```json
{
  "scheduleId": 1,
  "title": "신규 교육 변경",
  "content": "장소 변경: 5층 교육실",
  "scheduleDate": "2026-05-13",
  "startTime": "15:00",
  "endTime": "16:00",
  "writerName": "홍길동",
  "isMine": true,
  "createdAt": "2026-06-01T09:00:00Z",
  "modifiedAt": "2026-06-01T10:00:00Z"
}
```

## DELETE 일정 삭제

```txt
DELETE /wards/{wardId}/board/schedules/{scheduleId}
```

Response:

```txt
204 No Content
```

소프트 삭제를 사용한다면 `deleted_at`을 기록하고, 이후 GET 목록에서는 제외합니다.

## 검증 규칙

| 항목 | 규칙 |
| --- | --- |
| `title` | 필수, 빈 문자열 불가 |
| `scheduleDate` | 필수, `YYYY-MM-DD` |
| `startTime` | 선택, 값이 있으면 `HH:mm` |
| `endTime` | 선택, 값이 있으면 `HH:mm` |
| `wardId` | 현재 로그인 사용자가 접근 가능한 병동이어야 함 |
| `scheduleId` | 해당 `wardId` 소속 일정이어야 함 |

`content`, `startTime`, `endTime`은 빈 문자열로 들어오면 `null` 또는 미설정으로 처리해도 됩니다.

## 권한 정책

조회:

```txt
해당 병동에 연결된 관리자/간호사 모두 가능
```

등록:

```txt
기존 게시판 작성 권한과 동일하게 처리 권장
예: 병동 관리자 또는 BOARD_MANAGE 권한 사용자
```

수정/삭제:

```txt
작성자 본인 또는 병동 관리자 권한 사용자
```

현재 서비스 정책상 병동 관리자가 모든 게시판 일정을 관리할 수 있어야 한다면, 작성자가 아니어도 수정/삭제를 허용해 주세요.

## 프론트 연동 메모

현재 프론트 구현 위치:

```txt
apps/app/src/shared/api/board/index.ts
apps/app/src/pages/board/index.tsx
```

프론트는 다음 라우트를 호출합니다.

```txt
GET    /wards/{wardId}/board/schedules
POST   /wards/{wardId}/board/schedules
PUT    /wards/{wardId}/board/schedules/{scheduleId}
DELETE /wards/{wardId}/board/schedules/{scheduleId}
```

이 중 최소한 `GET /wards/{wardId}/board/schedules`가 먼저 구현되어야 현재 404 오류가 사라집니다.

