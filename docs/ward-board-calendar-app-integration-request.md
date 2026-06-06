# 앱팀 전달: 병동 캘린더 일반 일정 표시 연동 요청

## 배경

웹의 `게시판 > 병동 캘린더`에서 일반 일정을 등록하면, 같은 병동에 연결된 간호사의 앱 병동 캘린더에서도 해당 일정이 보여야 합니다.

현재 확인된 증상은 앱 병동 캘린더에 **게시글 마감 일정만 표시되고**, 웹에서 직접 등록한 병동 일반 일정은 표시되지 않는다는 것입니다.

## 결론

웹 코드는 일반 병동 일정을 이미 `board/schedules` API로 등록하고, 조회 응답의 `MANUAL` 일정도 렌더링하도록 구현되어 있습니다.

따라서 웹에서 등록한 일정이 `GET /wards/{wardId}/board/schedules` 응답에 포함되어 있는데 앱에만 보이지 않는다면, 앱이 병동 캘린더 데이터를 가져오거나 필터링하는 방식에서 `MANUAL` 일정을 누락하고 있을 가능성이 큽니다.

다만 API 응답 자체에 `MANUAL` 일정이 없다면 앱 문제가 아니라 백엔드 저장/조회 문제입니다.

## 앱에서 확인해야 할 API

앱 병동 캘린더는 게시글 마감 전용 API만 보면 안 되고, 아래 병동 캘린더 일정 API를 조회하거나 앱용 캘린더 API가 이 데이터를 포함해야 합니다.

```txt
GET /wards/{wardId}/board/schedules?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

예시:

```txt
GET /wards/287/board/schedules?startDate=2026-06-01&endDate=2026-06-30
```

이 API는 조회 범위와 겹치는 병동 캘린더 일정을 내려줘야 합니다.

## 일정 타입

응답의 `sourceType` 기준으로 앱에서 아래처럼 처리하면 됩니다.

| sourceType | 의미 | 앱 표시 |
| --- | --- | --- |
| `MANUAL` | 웹 병동 캘린더에서 직접 등록한 일반 일정 | 병동 일반 일정으로 표시 |
| `BOARD_DEADLINE` | 게시글 마감일에서 생성된 일정 | 게시글 마감 일정으로 표시 |
| 없음 | 구버전 호환 케이스 | `MANUAL`로 간주 가능 |

앱이 현재 `BOARD_DEADLINE` 또는 기존 `deadlines` 데이터만 표시하고 있다면, `MANUAL` 일정도 함께 렌더링해야 합니다.

## 웹에서 보내는 등록 요청 예시

종일 일정:

```json
{
  "title": "신규 교육",
  "content": "3층 교육실",
  "scheduleDate": "2026-06-10",
  "startDate": "2026-06-10",
  "endDate": "2026-06-10",
  "allDay": true,
  "isAllDay": true,
  "startTime": null,
  "endTime": null
}
```

시간 일정:

```json
{
  "title": "인수인계",
  "content": "회의실",
  "scheduleDate": "2026-06-10",
  "startDate": "2026-06-10",
  "endDate": "2026-06-10",
  "allDay": false,
  "isAllDay": false,
  "startTime": "09:00",
  "endTime": "10:00"
}
```

## 기대 응답 예시

일반 병동 일정:

```json
{
  "scheduleId": 1,
  "id": 1,
  "title": "신규 교육",
  "content": "3층 교육실",
  "scheduleDate": "2026-06-10",
  "startDate": "2026-06-10",
  "endDate": "2026-06-10",
  "isAllDay": true,
  "allDay": true,
  "startTime": null,
  "endTime": null,
  "writerName": "홍길동",
  "authorName": "홍길동",
  "sourceType": "MANUAL",
  "sourcePostId": null,
  "createdAt": "2026-06-07T09:00:00",
  "modifiedAt": "2026-06-07T09:00:00"
}
```

게시글 마감 일정:

```json
{
  "scheduleId": 2,
  "id": 2,
  "title": "공지 확인 마감",
  "scheduleDate": "2026-06-15",
  "startDate": "2026-06-15",
  "endDate": "2026-06-15",
  "isAllDay": true,
  "sourceType": "BOARD_DEADLINE",
  "sourcePostId": 123
}
```

## 앱 렌더링 규칙

- `sourceType: "MANUAL"` 일정은 병동 일반 일정으로 표시합니다.
- `sourceType: "BOARD_DEADLINE"` 일정은 기존처럼 게시글 마감 일정으로 표시합니다.
- `sourceType`이 없는 일정은 구버전 호환을 위해 `MANUAL`로 간주해도 됩니다.
- `startDate`부터 `endDate`까지 여러 날짜에 걸친 일정은 해당 기간의 날짜 칸에 모두 표시합니다.
- `isAllDay` 또는 `allDay`가 `true`이면 종일 일정으로 표시하고 시간을 숨깁니다.
- `isAllDay` 또는 `allDay`가 `false`이면 `startTime`, `endTime`을 표시합니다.
- 앱이 별도의 앱 캘린더 API를 사용 중이라면, 해당 API 응답에도 `MANUAL` 병동 일정이 포함되어야 합니다.

## 확인 방법

1. 웹에서 `게시판 > 병동 캘린더`에 일반 일정을 등록합니다.
2. 같은 병동 ID와 같은 날짜 범위로 아래 API를 호출합니다.

```txt
GET /wards/{wardId}/board/schedules?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

3. 응답에 `sourceType: "MANUAL"` 일정이 포함되어 있는지 확인합니다.
4. 포함되어 있는데 앱에 보이지 않으면 앱 쪽 조회/필터링/렌더링 문제입니다.
5. 포함되어 있지 않으면 백엔드 저장 또는 조회 API 문제입니다.

## QA 체크리스트

- 웹에서 등록한 종일 일반 일정이 앱 병동 캘린더에 보이는가?
- 웹에서 등록한 시간 일반 일정이 앱 병동 캘린더에 보이는가?
- 여러 날짜에 걸친 일정이 앱에서 기간 전체에 표시되는가?
- 게시글 마감 일정도 기존처럼 계속 보이는가?
- 앱이 `BOARD_DEADLINE`만 필터링하고 있지 않은가?
- 앱이 `/board/deadlines`만 조회하고 있지 않은가?

## 웹 구현 참고

- 웹 일정 조회/등록 API: `apps/app/src/shared/api/board/index.ts`
- 웹 병동 캘린더 렌더링: `apps/app/src/pages/board/index.tsx`
- 기존 백엔드 계약 문서: `docs/ward-board-calendar-backend-contract.md`
