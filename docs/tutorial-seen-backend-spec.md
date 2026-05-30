# Tutorial Seen Backend Spec

## 목적

튜토리얼은 브라우저가 아니라 계정 기준으로 한 번만 노출되어야 한다. 프론트의 `localStorage`는 API 실패나 응답 지연을 보완하는 캐시로만 사용하고, 최종 판단 기준은 백엔드의 계정별 튜토리얼 기록이다.

## 정책

- "딱 한 번 뜬다"의 기준은 튜토리얼이 화면에 실제로 열린 순간이다.
- 사용자가 완료 버튼을 누르지 않고 새로고침하거나 다른 페이지로 이동해도 같은 튜토리얼은 다시 노출하지 않는다.
- 나중에 같은 튜토리얼을 다시 보여줘야 하면 `version`을 올리거나 새 `tutorialKey`를 사용한다.
- API는 idempotent 해야 한다. 같은 요청이 여러 번 들어와도 중복 레코드를 만들지 않는다.

## 현재 프론트가 사용하는 Tutorial Key

```ts
type TutorialKey =
    | 'make'
    | 'make-step-1'
    | 'make-step-2'
    | 'make-step-3'
    | 'make-step-4'
    | 'make-step-5'
    | 'request'
    | 'member'
    | 'board'
    | 'board-list'
    | 'board-composer'
    | 'board-detail';
```

`make-step-*`는 근무표 만들기 화면의 단계별 튜토리얼이다. `make`는 전체 근무표 만들기 튜토리얼이 모두 seen 처리되었음을 나타내는 호환용 키로 사용할 수 있다.

## DB 스키마 제안

테이블명 예시: `account_tutorial_progress`

| 컬럼            | 타입               | 설명                                   |
| --------------- | ------------------ | -------------------------------------- |
| `id`            | bigint             | PK                                     |
| `account_id`    | bigint             | 계정 ID                                |
| `tutorial_key`  | varchar            | 튜토리얼 키                            |
| `version`       | int                | 튜토리얼 버전. 기본값 1                |
| `status`        | varchar            | `seen`, `completed`, `skipped` 중 하나 |
| `first_seen_at` | timestamp          | 최초 노출 시각                         |
| `completed_at`  | timestamp nullable | 완료 시각                              |
| `skipped_at`    | timestamp nullable | 건너뛰기 시각                          |
| `created_at`    | timestamp          | 생성 시각                              |
| `updated_at`    | timestamp          | 수정 시각                              |

필수 제약:

```sql
unique (account_id, tutorial_key, version)
```

## GET /accounts/me 응답 확장

기존 계정 응답에 `tutorials`를 optional 필드로 추가한다.

```json
{
    "accountId": 123,
    "name": "홍길동",
    "tutorials": {
        "seen": ["make-step-1", "request", "member"],
        "completed": [],
        "skipped": []
    }
}
```

프론트는 `tutorials.seen`에 포함된 키를 다시 노출하지 않는다. 백엔드 배포 전 호환을 위해 필드는 optional이어도 된다.

## POST /accounts/me/tutorials/{tutorialKey}/seen

튜토리얼이 실제로 열린 순간 프론트가 호출한다.

요청:

```http
POST /accounts/me/tutorials/make-step-1/seen
Authorization: Bearer <accessToken>
```

동작:

- 인증된 계정의 `account_id`를 사용한다. 클라이언트가 accountId를 보내지 않는다.
- `(account_id, tutorial_key, version)` 레코드가 없으면 생성한다.
- 이미 있으면 중복 생성하지 않고 기존 레코드를 유지하거나 `updated_at`만 갱신한다.
- 기존 상태가 `completed` 또는 `skipped`여도 `first_seen_at`은 바꾸지 않는다.

권장 응답:

```http
204 No Content
```

또는 갱신된 progress를 반환해도 된다. 프론트는 현재 응답 본문을 사용하지 않는다.

## 선택 API

완료/건너뛰기 분석이 필요하면 아래 API를 추가할 수 있다.

```http
POST /accounts/me/tutorials/{tutorialKey}/complete
POST /accounts/me/tutorials/{tutorialKey}/skip
```

다만 "한 번만 노출" 보장에는 `seen` API만 있어도 충분하다.

## 프론트 연동 상태

- 프론트는 `accountMe.tutorials?.seen`이 있으면 그 목록을 우선 사용한다.
- 튜토리얼이 실제로 open 되면 즉시 `POST /accounts/me/tutorials/{tutorialKey}/seen`을 호출한다.
- POST 실패 시 사용자 경험은 막지 않고, 같은 브라우저에서는 `localStorage` 캐시로 재노출을 줄인다.
- 백엔드가 `tutorials.seen`을 내려주기 시작하면 여러 기기/브라우저에서도 계정 단위로 한 번만 노출된다.
