# 병동 관리자 월별 개인 메모 API 요청

## 배경

`/make` 화면 월 헤더에 있는 `메모` 버튼에서, 로그인한 병동 관리자가 월별 개인 메모를 작성하고 다시 열람할 수 있어야 합니다.

이 메모는 병동 공지나 공유 메모가 아니라 현재 로그인한 관리자 계정 본인에게만 귀속되는 개인 기록입니다. 같은 관리자가 여러 병동에 접근할 수 있으므로 `wardId`까지 함께 저장해 병동별 메모가 섞이지 않도록 해주세요.

프론트엔드에는 UI와 API 호출 코드가 이미 연결되어 있고, 현재 백엔드 엔드포인트가 없어 실제 저장/조회가 실패하는 상태입니다.

## 저장 단위

메모는 아래 조합당 1개만 존재합니다.

```text
(adminAccountId, wardId, year, month)
```

- `adminAccountId`: 인증 토큰의 현재 병동 관리자 계정
- `wardId`: 메모가 속한 병동
- `year`: 대상 연도
- `month`: 대상 월, 1-12

## 권한

- 병동 관리자 인증 토큰이 필요합니다.
- 요청한 `wardId`에 대해 현재 관리자 계정이 활성 관리자 멤버십을 가지고 있어야 합니다.
- 권한이 없으면 `403 Forbidden`을 반환해주세요.
- 인증이 없거나 만료된 경우 기존 관리자 API 규칙과 동일하게 `401 Unauthorized`를 반환해주세요.

## API

### 월별 메모 조회

```http
GET /admin/accounts/me/monthly-memos?wardId={wardId}&year={year}&month={month}
```

#### Query

| field | type | required | description |
| --- | --- | --- | --- |
| `wardId` | number | Y | 병동 ID |
| `year` | number | Y | 대상 연도 |
| `month` | number | Y | 대상 월, 1-12 |

#### Response 200

메모가 이미 있는 경우:

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

메모가 아직 없는 경우에도 `404`가 아니라 빈 `content`로 `200`을 반환해주세요. 프론트는 조회 성공 후 textarea 초기값으로 `content`를 사용합니다.

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

`monthlyMemoId`, `accountId`는 새 메모가 아직 없을 때 생략 가능하지만, 생성된 메모 응답에는 포함해주세요.

### 월별 메모 저장

```http
PUT /admin/accounts/me/monthly-memos
```

같은 `(adminAccountId, wardId, year, month)` 조합의 메모가 있으면 수정하고, 없으면 생성하는 upsert 방식으로 처리해주세요.

프론트는 사용자가 입력을 멈춘 뒤 약 600ms 후 자동 저장합니다. 같은 메모에 대한 `PUT`이 반복 호출될 수 있으므로 멱등적으로 동작해야 합니다.

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
- `month`: 1 이상 12 이하 정수
- `content`: 문자열, 최대 1000자
- 빈 문자열 저장 허용
- `content`가 빈 문자열이어도 레코드를 삭제하지 말고 그대로 저장하거나 빈 메모 상태로 유지해주세요.

검증 실패 시 기존 관리자 API의 에러 포맷을 따라 `400 Bad Request`를 반환해주세요.

## DB 제약 제안

테이블명 예시:

```text
ward_admin_monthly_memo
```

| column | description |
| --- | --- |
| `monthly_memo_id` | PK |
| `admin_account_id` 또는 `account_id` | 현재 관리자 계정 ID |
| `ward_id` | 병동 ID |
| `year` | 대상 연도 |
| `month` | 대상 월 |
| `content` | 메모 본문 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

Unique key:

```sql
(admin_account_id, ward_id, year, month)
```

## 프론트엔드 연동 위치

- API client: `apps/app/src/shared/api/admin/index.ts`
- API type: `apps/app/src/shared/api/admin/type.ts`
- UI: `apps/app/src/features/monthly-memo/index.tsx`
- 화면 연결: `apps/app/src/pages/make-shift/ui/make-shift-header.tsx`

프론트에서 기대하는 타입은 아래와 같습니다.

```ts
export type TAdminMonthlyMemoResponse = {
    monthlyMemoId?: number;
    accountId?: number;
    wardId: number;
    year: number;
    month: number;
    content: string;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type TUpsertAdminMonthlyMemoDTO = {
    wardId: number;
    year: number;
    month: number;
    content: string;
};
```
