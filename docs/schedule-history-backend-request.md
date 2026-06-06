# 근무표 히스토리 백엔드 요청 사항

## OpenAPI 확인 결과

첨부된 OpenAPI 기준으로 `/make` 히스토리 관련 API는 일부 이미 존재한다.

| 항목 | OpenAPI 존재 여부 | 비고 |
| --- | --- | --- |
| 히스토리 목록 조회 | 있음 | `GET /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/snapshots` |
| 히스토리 저장 | 있음 | `POST /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/snapshots` |
| 히스토리 상세 조회 | 있음 | `GET /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/snapshots/{snapshotId}` |
| 히스토리 게시 | 있음 | `POST /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/snapshots/{snapshotId}/publish` |
| 히스토리 삭제 | 없음 | 프론트에서 필요 |
| 제목 수정 전용 API | 없음 | 현재 저장 API의 `snapshotId` update 방식으로 대체 가능 여부 확인 필요 |
| 목록 응답의 위반 수 | 없음 | `SnapshotSummaryDto`에 `hardCount`, `softCount`, `totalCount` 없음 |
| 10개 제한 명시 | 없음 | 서버 검증 및 에러 코드 필요 |

`ValidationSummaryDto`에는 `hardCount`, `softCount`, `totalCount`가 이미 있지만, 히스토리 목록 카드가 사용하는 `SnapshotSummaryDto`에는 해당 필드가 없다.

## 추가 요청이 필요한 항목

## 1. 히스토리 삭제 API 추가

### Endpoint

```http
DELETE /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/snapshots/{snapshotId}
```

### 필요 동작

- 히스토리 카드에서 사용자가 직접 삭제할 때 호출한다.
- 히스토리 10개 제한 모달에서 "가장 오래된 히스토리 삭제 후 저장"을 선택했을 때 먼저 호출한다.
- 삭제 대상이 해당 `wardId`, `shiftTeamId`에 속하지 않으면 `404` 또는 `403` 처리한다.
- 권한 없는 사용자는 `403` 처리한다.

### Response

```http
204 No Content
```

또는 body 없는 `200 OK`도 프론트에서 대응 가능하다.

## 2. 서버 사이드 10개 제한 추가

### 제한 범위

```txt
wardId + shiftTeamId + year + month
```

위 범위마다 히스토리는 최대 10개까지만 저장되어야 한다.

### 필요 동작

- 새 히스토리 생성 시 이미 10개이면 생성하지 않는다.
- 기존 히스토리 수정은 개수 제한에 걸리지 않아야 한다.
- 동시 저장 요청이 들어와도 10개를 초과하지 않도록 서버에서 트랜잭션 또는 락으로 보장한다.
- 기존 데이터가 이미 10개를 초과할 수 있다면 정리 방안이 필요하다.

### 권장 에러

```http
409 Conflict
```

```json
{
  "code": "SCHEDULE_SNAPSHOT_LIMIT_EXCEEDED",
  "message": "Schedule history can store up to 10 snapshots.",
  "maxCount": 10,
  "currentCount": 10,
  "oldestSnapshotId": 123
}
```

프론트도 저장 전 목록을 조회해서 10개 이상이면 삭제 확인 모달을 띄우지만, 서버에서도 반드시 제한해야 한다.

## 3. 목록 응답에 위반 수 추가

현재 OpenAPI의 `SnapshotSummaryDto`는 아래 필드만 있다.

```ts
type SnapshotSummaryDto = {
  snapshotId: number;
  title: string;
  year: number;
  month: number;
  cellCount: number;
  emptyCellCount: number;
  createdAt: string;
  updatedAt: string;
};
```

프론트 히스토리 카드에는 위반 수 표시가 필요하므로 아래 필드를 추가 요청한다.

```ts
type SnapshotSummaryDto = {
  snapshotId: number;
  title: string;
  year: number;
  month: number;
  cellCount: number;
  emptyCellCount: number;
  hardCount: number;
  softCount: number;
  totalCount: number;
  createdAt: string;
  updatedAt: string;
};
```

### 표시 규칙

- `hardCount > 0`이면 `중요위반 {hardCount}` 표시
- `softCount > 0`이면 `일반위반 {softCount}` 표시
- `0`, `null`, `undefined`이면 해당 배지 미표시
- 둘 다 0이면 카드 하단의 위반 영역 자체를 미표시

### 구현 방식 제안

- 히스토리 저장 시 validation summary를 계산해서 함께 저장하는 방식을 권장한다.
- 또는 목록 조회 시 스냅샷별 validation summary를 계산해서 반환할 수 있다.

성능상 저장 시 계산 후 저장하는 방식이 더 안전하다.

## 4. 제목 수정 방식 확정

첨부 OpenAPI에는 제목 수정 전용 API가 없다.

현재 존재하는 저장 API:

```http
POST /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/snapshots
```

현재 `SnapshotSaveReq`에는 `snapshotId`가 있으므로, 백엔드가 `snapshotId` 포함 요청을 update로 처리한다면 제목 수정은 이 API로 대체 가능하다.

### 확인 필요

- `snapshotId`가 있는 `POST /schedule/snapshots` 요청이 기존 히스토리 update로 동작하는지
- 제목만 바꾸기 위해 기존 `cells`, `rowOrder`를 다시 보내도 안전한지
- update 시 `createdAt`은 유지되고 `updatedAt` 또는 `savedAt`만 갱신되는지
- update는 10개 제한에 걸리지 않는지

### 권장 API

가능하면 제목 수정 전용 API를 추가하는 것이 프론트와 백엔드 모두 안전하다.

```http
PATCH /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/snapshots/{snapshotId}
```

```json
{
  "title": "V3 수정본"
}
```

권장 response:

```ts
type SnapshotSaveRes = {
  snapshotId: number;
  title: string;
  year: number;
  month: number;
  savedAt: string;
};
```

### 제목 검증

- trim 후 빈 문자열이면 `400`
- 너무 긴 제목 방지를 위해 max length 필요
- 권장 max length: 30 또는 50

## 5. 기존 API 유지 요청

아래 API는 이미 OpenAPI에 있으므로 그대로 유지되면 된다.

### 목록 조회

```http
GET /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/snapshots?year={year}&month={month}
```

Response:

```ts
type SnapshotListRes = {
  snapshots: SnapshotSummaryDto[];
};
```

### 저장

```http
POST /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/snapshots
```

Request:

```ts
type SnapshotSaveReq = {
  snapshotId?: number;
  title: string;
  year: number;
  month: number;
  prompt?: string;
  baseHash?: string;
  rowOrder: SnapshotRowOrderDto[];
  cells: SnapshotCellDto[];
};
```

Response:

```ts
type SnapshotSaveRes = {
  snapshotId: number;
  title: string;
  year: number;
  month: number;
  savedAt: string;
};
```

### 상세 조회

```http
GET /wards/{wardId}/shift-teams/{shiftTeamId}/schedule/snapshots/{snapshotId}
```

Response:

```ts
type SnapshotDetailRes = {
  snapshotId: number;
  title: string;
  year: number;
  month: number;
  prompt?: string;
  baseHash?: string;
  rowOrder: SnapshotRowOrderDto[];
  cells: SnapshotCellDto[];
  createdAt: string;
  updatedAt: string;
};
```

## 6. 권한 및 범위 검증

모든 히스토리 API는 아래를 검증해야 한다.

- 로그인 사용자 권한
- `wardId` 접근 권한
- `shiftTeamId`가 해당 ward에 속하는지
- `snapshotId`가 해당 ward/team/year/month 범위에 속하는지

## 7. 백엔드 요청 체크리스트

- [ ] `DELETE /schedule/snapshots/{snapshotId}` 추가
- [ ] 서버 사이드 10개 제한 추가
- [ ] 10개 제한 에러 코드 추가
- [ ] `SnapshotSummaryDto`에 `hardCount`, `softCount`, `totalCount` 추가
- [ ] `POST /schedule/snapshots`의 `snapshotId` update 동작 확정
- [ ] 제목 수정 전용 `PATCH` 추가 여부 결정
- [ ] 권한 및 범위 검증
- [ ] 기존 10개 초과 데이터 정리 방안 결정
