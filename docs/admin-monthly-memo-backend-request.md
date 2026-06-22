# 병동 관리자 월별 개인 메모 API 요청

## 배경

웹 병동 관리자가 월별로 간단한 개인 메모를 남길 수 있는 기능이 필요합니다.
메모는 병동 공지나 공유 메모가 아니라 로그인한 관리자 계정 본인에게만 귀속되는 개인 기록입니다.

프론트엔드는 `/make` 화면 월 헤더의 `메모` 버튼에서 아래 API를 호출하도록 구현되어 있습니다.

## 저장 단위

- `adminAccountId` 또는 현재 관리자 계정 식별자
- `wardId`
- `year`
- `month`

같은 관리자가 여러 병동에 접근할 수 있으므로 `wardId`를 포함해 병동별 메모가 섞이지 않도록 해주세요.

## 권한

- `WARD_ADMIN` 인증 토큰 필요
- 요청한 `wardId`에 대해 현재 관리자 계정이 활성 관리자 멤버십을 가지고 있어야 합니다.
- 권한이 없으면 `403`을 반환합니다.

## API

### 월별 메모 조회

`GET /admin/accounts/me/monthly-memos?wardId={wardId}&year={year}&month={month}`

#### Query

| 필드     | 타입   | 필수 | 설명          |
| -------- | ------ | ---- | ------------- |
| `wardId` | number | Y    | 병동 ID       |
| `year`   | number | Y    | 대상 연도     |
| `month`  | number | Y    | 대상 월, 1-12 |

#### Response 200

메모가 아직 없어도 `404` 대신 빈 `content`로 `200`을 반환해 주세요.

```json
{
    "monthlyMemoId": 123,
    "accountId": 45,
    "wardId": 1,
    "year": 2026,
    "month": 6,
    "content": "7월 신규 입사자 교육 일정 확인",
    "createdAt": "2026-06-22T09:00:00Z",
    "updatedAt": "2026-06-22T09:10:00Z"
}
```

빈 메모 예시:

```json
{
    "wardId": 1,
    "year": 2026,
    "month": 6,
    "content": "",
    "createdAt": null,
    "updatedAt": null
}
```

### 월별 메모 저장

`PUT /admin/accounts/me/monthly-memos`

같은 `(accountId, wardId, year, month)` 조합이 있으면 수정하고, 없으면 생성하는 upsert 방식으로 처리해 주세요.

#### Request Body

```json
{
    "wardId": 1,
    "year": 2026,
    "month": 6,
    "content": "7월 신규 입사자 교육 일정 확인"
}
```

#### Response 200

```json
{
    "monthlyMemoId": 123,
    "accountId": 45,
    "wardId": 1,
    "year": 2026,
    "month": 6,
    "content": "7월 신규 입사자 교육 일정 확인",
    "createdAt": "2026-06-22T09:00:00Z",
    "updatedAt": "2026-06-22T09:10:00Z"
}
```

## 검증 규칙

- `wardId`: 양의 정수
- `year`: 양의 정수
- `month`: 1 이상 12 이하
- `content`: 문자열, 최대 1000자
- 빈 문자열 저장 허용

## DB 제약 제안

`ward_admin_monthly_memo`

| 컬럼                                 | 설명             |
| ------------------------------------ | ---------------- |
| `monthly_memo_id`                    | PK               |
| `admin_account_id` 또는 `account_id` | 현재 관리자 계정 |
| `ward_id`                            | 병동 ID          |
| `year`                               | 대상 연도        |
| `month`                              | 대상 월          |
| `content`                            | 메모 본문        |
| `created_at`                         | 생성 시각        |
| `updated_at`                         | 수정 시각        |

Unique key:

```sql
(admin_account_id, ward_id, year, month)
```

## 프론트 연동 위치

- API 클라이언트: `apps/app/src/shared/api/admin/index.ts`
- UI: `apps/app/src/features/monthly-memo/index.tsx`
- 화면 연결: `apps/app/src/pages/make-shift/ui/make-shift-header.tsx`
