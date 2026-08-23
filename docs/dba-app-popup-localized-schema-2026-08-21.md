# DBA 전달: 앱 팝업 지역별 콘텐츠 DB 스키마

작성일: 2026-08-21

## 요약

앱 인앱 팝업 운영을 위해 아래 3개 테이블을 추가합니다.

- `app_popup`: 팝업 캠페인 공통 설정
- `app_popup_content`: 지역별 콘텐츠. `KR/ko`, `JP/ja`, `EN/en`
- `app_popup_event`: 사용자별 노출/클릭/닫기 이벤트

개발 반영 migration:

```text
dutying-server/src/main/resources/db/migration/V87__app_popup_localized_content.sql
```

## 테이블

### `app_popup`

| column | type | null | 설명 |
| --- | --- | --- | --- |
| `app_popup_id` | bigint | N | PK, auto increment |
| `internal_title` | varchar(80) | N | 관리자 식별용 제목 |
| `status` | varchar(20) | N | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `enabled` | bit | N | 활성화 여부 |
| `platform` | varchar(20) | N | `MOBILE`, `IOS`, `AOS`, `ALL` |
| `frequency_type` | varchar(30) | N | `ONCE`, `ONCE_PER_DAY`, `EVERY_SESSION` |
| `max_impressions_per_user` | integer | Y | 사용자별 최대 노출 수 |
| `priority` | integer | N | 우선순위. 높을수록 먼저 노출 |
| `start_at` | datetime(6) | N | 노출 시작 시각 |
| `end_at` | datetime(6) | Y | 노출 종료 시각 |
| `created_at` | datetime(6) | Y | 생성 시각 |
| `modified_at` | datetime(6) | Y | 수정 시각 |

### `app_popup_content`

| column | type | null | 설명 |
| --- | --- | --- | --- |
| `app_popup_content_id` | bigint | N | PK, auto increment |
| `app_popup_id` | bigint | N | `app_popup` FK |
| `target_region` | varchar(10) | N | v1 허용값: `KR`, `JP`, `EN` |
| `language` | varchar(10) | N | v1 허용값: `ko`, `ja`, `en` |
| `title` | varchar(80) | N | 앱 표시 제목 |
| `body` | varchar(500) | N | 앱 표시 본문 |
| `image_url` | varchar(2048) | Y | 이미지 CDN/S3 URL |
| `cta_label` | varchar(30) | Y | CTA 버튼 문구 |
| `cta_url` | varchar(2048) | Y | 앱 내부 경로 또는 HTTPS URL |
| `created_at` | datetime(6) | Y | 생성 시각 |
| `modified_at` | datetime(6) | Y | 수정 시각 |

Unique key:

```sql
unique (app_popup_id, target_region)
```

동일 캠페인에 같은 지역 콘텐츠가 2개 이상 들어가지 않도록 막습니다.

### `app_popup_event`

| column | type | null | 설명 |
| --- | --- | --- | --- |
| `app_popup_event_id` | bigint | N | PK, auto increment |
| `app_popup_id` | bigint | N | `app_popup` FK |
| `app_popup_content_id` | bigint | N | `app_popup_content` FK |
| `account_id` | bigint | N | `account` FK |
| `target_region` | varchar(10) | N | 이벤트 당시 노출 지역 |
| `language` | varchar(10) | N | 이벤트 당시 노출 언어 |
| `event_type` | varchar(30) | N | `IMPRESSION`, `CLICK`, `DISMISS`, `HIDE_TODAY` |
| `event_date` | date | N | KST 기준 이벤트 날짜 |
| `event_token` | varchar(80) | Y | eligible 응답에서 내려준 이벤트 토큰 |
| `created_at` | datetime(6) | Y | 발생 시각 |
| `modified_at` | datetime(6) | Y | 수정 시각 |

`event_date`는 `ONCE_PER_DAY`, `HIDE_TODAY` 차단 조회를 빠르게 하기 위한 컬럼입니다.

## 인덱스

```sql
create index idx_app_popup_admin
    on app_popup (status, enabled, platform, created_at, app_popup_id);
```

관리자 목록 필터와 커서 조회용입니다.

```sql
create index idx_app_popup_eligible
    on app_popup (status, enabled, platform, start_at, end_at, priority, app_popup_id);
```

앱 eligible 후보 조회용입니다.

```sql
create index idx_app_popup_content_target
    on app_popup_content (target_region, language, app_popup_id);
```

사용자 지역/언어에 맞는 콘텐츠 조인 조회용입니다.

```sql
create index idx_app_popup_event_frequency
    on app_popup_event (account_id, app_popup_id, event_type, event_date);
```

사용자별 `ONCE`, `ONCE_PER_DAY`, `maxImpressionsPerUser` 판단용입니다.

```sql
create index idx_app_popup_event_stats
    on app_popup_event (app_popup_id, target_region, language, event_type, created_at);
```

관리자 통계 조회용입니다.

## FK 정책

- `app_popup_content.app_popup_id`는 `app_popup` 삭제 시 cascade delete
- `app_popup_event.app_popup_id`는 `app_popup` 삭제 시 cascade delete
- `app_popup_event.app_popup_content_id`는 `app_popup_content` 삭제 시 cascade delete
- `app_popup_event.account_id`는 `account(account_id)` FK

현재 애플리케이션에서는 관리자 삭제가 물리 삭제가 아니라 `ARCHIVED` 상태 전환이므로, 일반 운영에서 cascade delete가 빈번히 발생하지 않습니다.

## 운영 주의점

- 이미지 파일 자체는 DB에 저장하지 않습니다. DB에는 `image_url`만 저장합니다.
- 관리자 이미지 첨부 파일은 S3 `app_popup_img/` 경로에 업로드되고, 공개 URL만 `app_popup_content.image_url`에 저장됩니다.
- v1 서버 검증은 `KR/ko`, `JP/ja`, `EN/en`만 허용합니다.
- 콘텐츠가 없는 지역에는 fallback 노출하지 않습니다.
- `app_popup_event`는 노출 이벤트가 누적되는 테이블이라 장기적으로 보관 기간 정책이 필요할 수 있습니다.
- 초기 운영량이 작으면 현 인덱스로 충분합니다. 팝업 노출량이 커지면 `app_popup_event` 월별 파티셔닝 또는 기간별 아카이빙을 검토해 주세요.

## 롤백 참고

데이터 보존이 필요 없고 배포 롤백이 필요한 경우에는 FK 순서상 아래 순서로 drop합니다.

```sql
drop table app_popup_event;
drop table app_popup_content;
drop table app_popup;
```

운영 DB에서는 drop 전 이벤트 통계 보존 필요 여부를 먼저 확인해야 합니다.
