# 앱/웹 알림 정책 싱크 문서

작성일: 2026-08-02

이 문서는 앱/웹에서 알림 설정 화면, 알림함, unread count, 빨간점, 푸시 클릭 이동을 맞추기 위한 최신 서버 기준 정책입니다.

기존 `app-req-shift-reception-notification-request-2026-07-27.md`의 `wardAppliedDuty` OFF 시 `REQ_SHIFT_RECEPTION` row를 만들지 않는다는 내용은 이 문서로 대체합니다.

## 서버 반영 상태

2026-08-02 기준으로 아래 항목은 서버에 반영되었습니다.

- 알림 row 생성 정책과 FCM push 발송 정책 분리
- `marketingPush=false`일 때만 row와 FCM 모두 제외
- 나머지 8개 토글 OFF 시 row 생성, FCM만 제외
- `REQ_SHIFT_RECEPTION`, `REQ_SHIFT_APPROVED`, `REQ_SHIFT_REJECTED`, `TODAY_SHIFT`, `POST_DUTY_WARD`의 토글 OFF 시 row 유지
- `REQ_SHIFT_RECEPTION` URL을 신청근무 화면 경로로 보강
- `REQ_SHIFT_APPROVED`, `REQ_SHIFT_REJECTED` URL을 신청근무 화면 경로로 보강
- `TODAY_SHIFT`의 `domain/sourceType/sourceId/url/dedupeKey` 보강
- `POST_DUTY_WARD`의 `domain/sourceType/sourceId/url/dedupeKey` 보강
- 친구 요청 거절 classification을 `REFUSE_FRIEND_REQUEST`로 수정
- `WARD_NOTICE` classification과 `wardNotice` push 설정 매핑 준비

아래 항목은 별도 후속입니다.

- 당일 근무를 근무 시작 60분 전 자동 발송하는 스케줄러
- 병동 공지를 실제로 `WARD_NOTICE/domain=WARD`로 팬아웃하는 발행 기능
- 소셜/모임 알림의 상세 `sourceId/url` 정규화

## 결론

알림 정책은 단순하게 두 층으로 나눕니다.

1. `/notifications` row: 앱/웹 알림함, unread count, 빨간점, SSE 실시간 갱신의 기준 데이터입니다.
2. FCM push: 휴대폰 OS에 표시되는 외부 푸시입니다.

앱의 9개 알림 설정은 기본적으로 "푸시 수신 설정"으로 봅니다.

예외는 `marketingPush`입니다. 마케팅은 수신 동의 성격이 강하므로 OFF이면 알림 row와 FCM push를 모두 만들지 않습니다.

그 외 업무/소셜/커뮤니티 알림은 사용자가 토글을 OFF해도 `/notifications` row는 생성하고, FCM push만 보내지 않습니다.

## 공통 서버 정책

### row 생성 정책

서버는 아래 제외 조건에 걸리지 않으면 먼저 `/notifications` row를 생성합니다.

- 수신자가 없거나 탈퇴/삭제된 계정인 경우
- 본인 액션인 경우
- 수신자가 발신자를 차단한 경우
- 병동/모임/게시글/댓글 등 대상 리소스 권한이 없는 경우
- 같은 이벤트가 dedupe key 기준 이미 생성된 경우
- `classification=MARKETING`이고 수신자의 `marketingPush=false`인 경우

위 경우를 제외하면 사용자 알림 설정 토글이 OFF여도 row는 생성합니다.

### FCM 발송 정책

FCM push는 row 생성 이후 별도로 판단합니다.

- 수신자의 FCM 토큰이 없으면 row만 남기고 push는 보내지 않습니다.
- 앱 알림 설정 토글이 OFF이면 row만 남기고 push는 보내지 않습니다.
- 관리자 발송 옵션, 병동 알림 옵션, 플랫폼 조건이 OFF이면 push는 보내지 않습니다.
- 웹 전용 알림은 row와 SSE만 사용하고 FCM은 보내지 않습니다.

### foreground 정책

앱이 foreground인지 background인지 서버는 알 수 없다고 봅니다.

서버는 앱 상태와 무관하게 동일하게 row를 생성하고, push 조건이 맞으면 FCM을 보냅니다. foreground 표시 방식은 앱에서 결정합니다.

### FCM data payload

일반 사용자 알림 FCM data에는 아래 필드를 항상 포함합니다.

```json
{
  "notificationId": "12345",
  "classification": "REQ_SHIFT_RECEPTION",
  "domain": "WARD_REQ_SHIFT",
  "sourceType": "REQ_SHIFT_RECEPTION",
  "sourceId": "678",
  "url": "/request?wardId=1&year=2026&month=8"
}
```

규칙:

- 모든 값은 FCM data 제약에 맞춰 string으로 내려갑니다.
- `notificationId`는 알림 row id입니다.
- `url`은 앱/웹에서 바로 라우팅 가능한 경로여야 합니다.
- 신규 업무 알림은 `domain`, `sourceType`, `sourceId`, `url`을 null로 만들지 않습니다.
- 소셜/모임 일부 기존 알림은 아직 row URL이 없을 수 있으며, 앱은 classification/domain fallback을 유지합니다.
- 구버전 row에 url이 없을 수 있으므로 앱은 domain fallback을 유지합니다.

## 앱 설정 9개 매핑

| 설정 필드 | 의미 | 기본값 | OFF 시 서버 정책 |
| --- | --- | --- | --- |
| `marketingPush` | 마케팅/캠페인 | false | row 생성 안 함, FCM 안 보냄 |
| `shiftSameDayReminder` | 당일 근무 리마인더 | true | row 생성, FCM 안 보냄 |
| `nultalkCommentReply` | 널톡 댓글/대댓글 | true | row 생성, FCM 안 보냄 |
| `nultalkLike` | 널톡 글/댓글 좋아요 | true | row 생성, FCM 안 보냄 |
| `socialFriendRequest` | 친구 요청/수락/거절 | true | row 생성, FCM 안 보냄 |
| `socialMoimInvite` | 모임 초대/가입/변경 | true | row 생성, FCM 안 보냄 |
| `wardDutyRosterUpdate` | 병동 근무표 게시/수정 | true | row 생성, FCM 안 보냄 |
| `wardAppliedDuty` | 신청근무 접수/승인/거절 | true | row 생성, FCM 안 보냄 |
| `wardNotice` | 병동 공지 | true | row 생성, FCM 안 보냄 |

앱 설정 화면 문구는 가능하면 "푸시 알림" 기준으로 표현합니다. 알림함 기록까지 끄는 설정으로 안내하지 않습니다.

## 이벤트별 서버 계약

| 이벤트 | 발생 시점 | 수신자 | 설정 필드 | classification | domain | sourceType | sourceId | url | OFF 시 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 마케팅 발송 | 관리자 마케팅 캠페인 발송 | 타겟 계정 | `marketingPush` | `MARKETING` | `ADMIN_BROADCAST` | `ADMIN_BROADCAST` | broadcast id | 관리자 지정 url | row/FCM 모두 제외 |
| 앱 전역 공지 | 운영자가 앱 공지 게시 | 공지 타겟 계정 | 현재 9개 토글 없음 | `NOTICE` | `NOTICE` | `NOTICE` | notice id | `/dutying/notices/{noticeId}` | 토글 영향 없음 |
| 널톡 댓글 | 내 글에 타인이 댓글 작성 | 글 작성자 | `nultalkCommentReply` | `NULTALK_COMMENT` | `NULTALK` | `NULTALK_POST` | post id | `/nultalk/posts/{postId}` | row 생성, FCM 제외 |
| 널톡 대댓글 | 내 댓글에 타인이 답글 작성 | 원 댓글 작성자 | `nultalkCommentReply` | `NULTALK_REPLY` | `NULTALK` | `NULTALK_COMMENT` | parent comment id | `/nultalk/posts/{postId}` | row 생성, FCM 제외 |
| 널톡 글 좋아요 | 내 글에 타인이 좋아요 | 글 작성자 | `nultalkLike` | `NULTALK_POST_LIKE` | `NULTALK` | `NULTALK_POST` | post id | `/nultalk/posts/{postId}` | row 생성, FCM 제외 |
| 널톡 댓글 좋아요 | 내 댓글에 타인이 좋아요 | 댓글 작성자 | `nultalkLike` | `NULTALK_COMMENT_LIKE` | `NULTALK` | `NULTALK_COMMENT` | comment id | `/nultalk/posts/{postId}` | row 생성, FCM 제외 |
| 친구 요청 수신 | 타인이 친구 요청 | 요청 수신자 | `socialFriendRequest` | `RECEIVE_FRIEND_REQUEST` | 현재 일부 null | 현재 일부 null | 현재 일부 null | 현재 일부 null | row 생성, FCM 제외 |
| 친구 요청 수락 | 상대가 친구 요청 수락 | 요청자 | `socialFriendRequest` | `ACCEPT_FRIEND_REQUEST` | 현재 일부 null | 현재 일부 null | 현재 일부 null | 현재 일부 null | row 생성, FCM 제외 |
| 친구 요청 거절 | 상대가 친구 요청 거절 | 요청자 | `socialFriendRequest` | `REFUSE_FRIEND_REQUEST` | 현재 일부 null | 현재 일부 null | 현재 일부 null | 현재 일부 null | row 생성, FCM 제외 |
| 모임 초대/가입/변경 | 모임 초대, 가입 승인/거절, 강퇴, 방장 변경, 삭제 | 대상 멤버 | `socialMoimInvite` | 모임 관련 classification | 현재 일부 null | 현재 일부 null | 현재 일부 null | 일부 `/moims/{moimId}` | row 생성, FCM 제외 |
| 당일 근무 리마인더 | 현재 서버 v1은 관리자 발행 API 기준 | 해당 근무자 | `shiftSameDayReminder` | `TODAY_SHIFT` | `WARD` | `DUTY_ROSTER` | account shift id | `/duty?date={yyyy-MM-dd}` | row 생성, FCM 제외 |
| 신청근무 접수 시작 | 병동 접수 기간이 열리는 시점 | 병동 활성/연동 간호사 | `wardAppliedDuty` | `REQ_SHIFT_RECEPTION` | `WARD_REQ_SHIFT` | `REQ_SHIFT_RECEPTION` | 예약 알림 id | `/request?wardId={wardId}&year={year}&month={month}` | row 생성, FCM 제외 |
| 신청근무 마감 임박 | 접수 마감 N시간 전. 기본값 24시간 | 병동 활성/연동 간호사 | `wardAppliedDuty` | `REQ_SHIFT_RECEPTION` | `WARD_REQ_SHIFT` | `REQ_SHIFT_RECEPTION` | 예약 알림 id | `/request?wardId={wardId}&year={year}&month={month}` | row 생성, FCM 제외 |
| 신청근무 승인 | 관리자가 신청근무 승인 | 신청자 | `wardAppliedDuty` | `REQ_SHIFT_APPROVED` | `WARD_REQ_SHIFT` | `REQ_SHIFT` | reqShift id | `/request?wardId={wardId}&year={year}&month={month}` | row 생성, FCM 제외 |
| 신청근무 거절 | 관리자가 신청근무 거절 | 신청자 | `wardAppliedDuty` | `REQ_SHIFT_REJECTED` | `WARD_REQ_SHIFT` | `REQ_SHIFT` | reqShift id | `/request?wardId={wardId}&year={year}&month={month}` | row 생성, FCM 제외 |
| 근무표 게시/수정 | 병동 근무표가 게시 또는 갱신됨 | 해당 병동 구성원 | `wardDutyRosterUpdate` | `POST_DUTY_WARD` 또는 `WARD_DUTY_ROSTER_UPDATED` | `WARD` | `DUTY_ROSTER` | roster id | `/duty?wardId={wardId}&year={year}&month={month}` | row 생성, FCM 제외 |
| 병동 가입 승인 | 병동 가입/연동 승인 | 신청자 | 현재 9개 토글 없음 | `WARD_JOIN_APPROVED` | `WARD` | `WARD_JOIN_REQUEST` | request id | `/app/ward` | 토글 영향 없음 |
| 병동 가입 거절 | 병동 가입/연동 거절 | 신청자 | 현재 9개 토글 없음 | `WARD_JOIN_REJECTED` | `WARD` | `WARD_JOIN_REQUEST` | request id | `/app/ward` | 토글 영향 없음 |
| 병동 공지 | 후속 구현 대상 | 해당 병동 구성원 | `wardNotice` | `WARD_NOTICE` | `WARD` | `WARD_NOTICE` | notice id 또는 board post id | `/board?postId={postId}` | row 생성, FCM 제외 |
| 게시판 댓글 | 병동 게시글에 댓글 작성 | 글 작성자 | 현재 9개 토글 없음 | `WARD_BOARD_COMMENT` | `BOARD` | `WARD_BOARD_POST` | post id | `/board?postId={postId}` | row/SSE 유지, FCM 없음 |
| 게시판 대댓글 | 병동 댓글에 답글 작성 | 원 댓글 작성자 | 현재 9개 토글 없음 | `WARD_BOARD_REPLY` | `BOARD` | `WARD_BOARD_COMMENT` | comment id | `/board?postId={postId}&commentId={commentId}` | row/SSE 유지, FCM 없음 |
| 게시판 확인 | 병동 게시글 확인 처리 | 글 작성자 | 현재 9개 토글 없음 | `WARD_BOARD_CHECK` | `BOARD` | `WARD_BOARD_POST` | post id | `/board?postId={postId}` | row/SSE 유지, FCM 없음 |
| 캘린더 일정 생성 | 병동 캘린더 일정 생성 | 병동 구성원 | 현재 9개 토글 없음 | `WARD_CALENDAR_CREATED` | `CALENDAR` | `WARD_CALENDAR_EVENT` | event id | `/board?calendarDate={yyyy-MM-dd}&scheduleId={eventId}` | row/SSE 유지, FCM 없음 |
| 캘린더 일정 수정 | 병동 캘린더 일정 수정 | 병동 구성원 | 현재 9개 토글 없음 | `WARD_CALENDAR_UPDATED` | `CALENDAR` | `WARD_CALENDAR_EVENT` | event id | `/board?calendarDate={yyyy-MM-dd}&scheduleId={eventId}` | row/SSE 유지, FCM 없음 |
| 오늘 일정 알림 | 매일 07:00 KST, 오늘 일정이 있는 경우 | 병동 구성원 | 현재 9개 토글 없음 | `WARD_CALENDAR_TODAY` | `CALENDAR` | `WARD_CALENDAR_EVENT` | event id | `/board?calendarDate={yyyy-MM-dd}&scheduleId={eventId}` | row/SSE 유지, FCM 없음 |

## 신청근무 접수 알림 세부 정책

신청근무 접수 알림은 두 종류입니다.

| type | 발송 시점 | 문구 방향 |
| --- | --- | --- |
| `OPEN` | 접수 시작 시점 | `{month}월 신청근무 접수가 시작되었습니다.` |
| `CLOSING_SOON` | 접수 마감 N시간 전 | `{month}월 신청근무 접수 마감이 {hours}시간 남았습니다.` |

정책:

- 병동 관리자의 접수 알림 옵션이 OFF이면 해당 이벤트 자체를 예약/생성하지 않습니다.
- 병동 관리자의 접수 알림 옵션이 ON이면 수신자별 row를 생성합니다.
- 사용자의 `wardAppliedDuty=false`이면 row는 생성하지만 FCM push는 보내지 않습니다.
- `notifyBeforeDeadlineHours`는 저장값을 사용합니다.
- 서버 구현 여건상 v1에서 고정이 필요하면 24시간으로 고정하되, 응답값과 실제 발송 기준이 반드시 같아야 합니다.
- 같은 병동/대상 월/type/수신자 기준으로 중복 row가 생기지 않도록 dedupe key를 둡니다.

## 당일 근무 리마인더 세부 정책

당일 근무 리마인더는 서버 발송을 기준으로 합니다. 현재 서버 v1은 관리자 발행 API인 `GET /notifications/today-shift`에서 `TODAY_SHIFT` 알림을 생성합니다.

정책:

- 근무 시작 시간이 있으면 시작 60분 전에 발송합니다.
- 근무 시작 시간이 없으면 해당 근무일 07:00 KST에 발송합니다.
- 수신자는 해당 날짜에 근무가 배정된 계정입니다.
- `shiftSameDayReminder=false`이면 row는 생성하고 FCM push만 보내지 않습니다.
- 같은 계정/병동/근무일/근무 기준으로 중복 row가 생기지 않도록 dedupe key를 둡니다.

자동 스케줄러는 후속 구현 대상입니다. 자동화가 들어오기 전까지 앱은 `TODAY_SHIFT`가 언제나 자동으로 온다고 전제하지 않습니다.

## 앱/웹 처리 기준

앱과 웹은 알림 이동을 `data.url` 또는 row의 `url` 기준으로 처리합니다.

권장 fallback:

| domain | fallback route |
| --- | --- |
| `BOARD` | `/board` |
| `CALENDAR` | `/board` |
| `WARD_REQ_SHIFT` | `/request` |
| `WARD` | `/duty` 또는 계정 상태 재조회 후 적절한 병동 화면 |
| `NOTICE` | `/dutying/notices` |
| `NULTALK` | 널톡 홈 |
| `SOCIAL` | 소셜 홈 |
| 기타/null | `/home` |

알림 클릭 시:

1. `notificationId`가 있으면 읽음 처리합니다.
2. `url`로 이동합니다.
3. 업무 상태성 알림은 화면 진입 후 관련 API를 재조회합니다.

예:

- `REQ_SHIFT_RECEPTION`: 신청근무 화면 진입 후 reception-status 재조회
- `REQ_SHIFT_APPROVED`, `REQ_SHIFT_REJECTED`: 신청근무 목록/상세 재조회
- `WARD_JOIN_APPROVED`, `WARD_JOIN_REJECTED`: `GET /accounts/me` 재조회
- `POST_DUTY_WARD`: 근무표 월 데이터 재조회
- `WARD_NOTICE`, `WARD_BOARD_*`, `WARD_CALENDAR_*`: 게시판/캘린더 데이터 재조회

## 서버 구현 메모

서버는 알림 설정을 row 생성 gate로 직접 쓰지 않습니다. 단, `MARKETING`만 예외입니다.

권장 구조:

```text
shouldCreateRow(event, receiver, actor)
  - self action, deleted account, blocked user, unauthorized resource, dedupe 검사
  - MARKETING + marketingPush=false이면 false
  - 그 외 true

shouldSendPush(event, receiver)
  - row 생성 후 판단
  - token 없음, sendPush=false, platform mismatch이면 false
  - event에 매핑된 설정 필드가 false이면 false
  - 웹 전용 알림이면 false
  - 그 외 true
```

`createInAppWithSource` 같은 in-app 전용 생성 경로는 앱 푸시 설정 때문에 row 생성이 막히면 안 됩니다.

## DB 변경 여부

이번 정책 반영에는 DB 변경이 필요하지 않았습니다.

반영된 서버 로직:

- 알림 설정 OFF 처리 위치를 row 생성 전에서 FCM 발송 전으로 이동
- `MARKETING`만 OFF 시 row 생성 제외
- 신청근무/당일근무/근무표 알림의 `domain`, `sourceType`, `sourceId`, `url` 보강
- 친구 요청 거절 classification을 `REFUSE_FRIEND_REQUEST`로 수정
- 병동 공지용 `WARD_NOTICE/domain=WARD` classification과 설정 매핑 준비

후속 서버 로직:

- 병동 공지 실제 발행 시 `WARD_NOTICE/domain=WARD` 사용
- 소셜/모임 알림의 `domain`, `sourceType`, `sourceId`, `url` 정규화

DB 변경이 필요한 경우는 새 토글을 추가하거나, DB enum/check constraint가 신규 classification/domain을 막는 경우뿐입니다.

## QA 체크리스트

- `marketingPush=false`인 계정은 마케팅 row와 FCM을 모두 받지 않습니다.
- `wardAppliedDuty=false`인 계정도 `REQ_SHIFT_RECEPTION` row는 생성되고 FCM만 오지 않습니다.
- `shiftSameDayReminder=false`인 계정도 `TODAY_SHIFT` row는 생성되고 FCM만 오지 않습니다.
- 널톡/친구/모임 토글 OFF 시 row는 생성되고 FCM만 오지 않습니다.
- 근무표/병동공지 토글 OFF 시 row는 생성되고 FCM만 오지 않습니다.
- FCM 토큰이 없는 계정도 row는 생성됩니다.
- foreground/background/terminated 상태와 무관하게 서버 row 생성 정책은 동일합니다.
- 본인 액션은 row와 FCM 모두 생성되지 않습니다.
- 차단/탈퇴/삭제/권한 없음 수신자는 row와 FCM 모두 생성되지 않습니다.
- 모든 일반 FCM data에 `notificationId`, `classification`, `domain`, `sourceType`, `sourceId`, `url`이 포함됩니다.
- 알림 클릭 후 앱/웹이 올바른 화면으로 이동하고 필요한 데이터를 재조회합니다.
