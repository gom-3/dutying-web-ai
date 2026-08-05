# DBA 전달 문서: 널톡 인기 검색어 API 및 DB 검토

- 작성일: 2026-08-04
- 요청자: 모바일 앱 팀
- 대상: DBA 담당자, 백엔드 팀
- 관련 화면: 널톡 > 검색

## 1. 요청 배경

널톡 검색 화면에 노출되는 인기 검색어를 앱 하드코딩이 아닌 서버 응답 기반으로 노출하려고 합니다.

최근 검색어는 사용자 기기 로컬에만 저장합니다. 최근 검색어는 서버 API, 검색 로그, DB 저장 대상이 아닙니다.

인기 검색어만 서버에서 내려받으며, 앱은 키워드 목록을 받아 칩 형태로 노출합니다.

## 2. 현재 백엔드 1차 반영 상태

백엔드는 DB 변경 없이 1차 API를 반영했습니다.

현재 구현은 서버 고정 리스트를 응답하는 방식입니다. 따라서 현 시점에서는 DBA 즉시 작업 없이 앱 연동이 가능합니다.

```http
GET /nultalk/search/popular-keywords
```

### Query

| 파라미터 | 필수 | 현재 처리 | 비고 |
| --- | --- | --- | --- |
| `limit` | N | 기본 10개, 최대 20개 | 0 이하 또는 미전달 시 10개 |
| `region` | N | 전달 시 해당 서비스 리전 기준으로 처리 | 미전달 시 기존 널톡 리전 해석 흐름 사용 |

### Response

```json
{
  "keywords": [
    "로테이션",
    "이직",
    "여름 휴가",
    "신청근무",
    "프리셉터"
  ],
  "aggregatedAt": "2026-08-04T09:00:00+09:00"
}
```

### 현재 1차 구현의 의미

- API path와 response contract는 앱 연동 가능한 상태입니다.
- `keywords`는 노출 순서대로 정렬된 문자열 배열입니다.
- `aggregatedAt`은 현재 서버 응답 생성 시각 기준으로 내려갑니다.
- 현재는 실제 검색 로그 기반 집계가 아니라 서버 고정 리스트입니다.
- 현재는 DB migration이나 신규 테이블이 없습니다.
- 이후 DBA/백엔드 정책이 정리되면 API contract는 유지하고 데이터 소스만 DB, 캐시, 운영 관리 리스트 등으로 교체할 수 있습니다.

## 3. 프론트 반영 예정

프론트는 널톡 검색 화면 진입 시 인기 검색어 API를 호출할 예정입니다.

```http
GET /nultalk/search/popular-keywords?limit=10
```

프론트 동작 기준은 아래와 같습니다.

- `keywords`가 1개 이상이면 검색 화면의 인기 검색어 칩에 서버 응답을 노출합니다.
- `keywords`가 빈 배열이면 앱 내 하드코딩 fallback을 노출합니다.
- API 호출 실패, 인증 오류, 네트워크 오류가 발생해도 검색 화면은 깨지지 않고 앱 fallback을 노출합니다.
- 인기 검색어 칩을 누르면 기존 검색 API로 검색 결과 화면을 엽니다.

```http
GET /nultalk/posts?keyword={keyword}
```

최근 검색어는 기존처럼 기기 로컬 저장만 유지합니다.

## 4. 백엔드 팀 후속 요청

DBA 검토 결과에 따라 백엔드 팀은 아래 항목을 후속 반영 부탁드립니다.

### API contract 유지

앱 연동 안정성을 위해 아래 response shape는 유지 부탁드립니다.

```ts
type NultalkPopularKeywordsResponse = {
  keywords: string[];
  aggregatedAt?: string;
};
```

`keywords`는 항상 배열로 내려주세요. 노출할 키워드가 없으면 `null` 대신 빈 배열 `[]`로 내려주시면 앱 fallback 처리가 안전합니다.

### 데이터 소스 교체

현재는 서버 고정 리스트입니다. 이후 운영 정책에 따라 아래 중 하나로 교체할 수 있습니다.

- 운영 관리자가 직접 관리하는 고정/추천 키워드 리스트
- 실제 검색 로그 기반 집계 결과
- 검색 로그 기반 집계 결과와 운영 수동 보정 리스트의 조합
- Redis 등 캐시에 저장된 집계 결과

데이터 소스를 교체해도 API path, query, response field는 유지해 주세요.

### 검색어 노출 필터링

앱으로 내려가기 전에 백엔드에서 최종 필터링을 수행해 주세요.

- 개인정보성 검색어 제외
- 금칙어 제외
- 비속어, 혐오, 성적 표현 등 부적절 검색어 제외
- 운영자가 숨김 처리한 검색어 제외
- 검색 결과 0건 키워드 제외 여부는 정책 결정 후 반영

### 캐싱

인기 검색어는 실시간성이 높지 않으므로 캐싱이 가능합니다.

- 앱 조회 API는 DB 집계 쿼리를 직접 매번 실행하지 않는 것을 권장합니다.
- 집계 결과 테이블 또는 Redis 캐시를 읽고, 집계 배치가 주기적으로 갱신하는 구조를 권장합니다.
- `aggregatedAt`은 실제 집계 결과 기준 시각을 내려주는 것이 QA에 유리합니다.

## 5. DBA 검토 요청

현 시점에는 DB 변경 없이 API가 동작합니다.

다만 운영에서 실제 인기 검색어를 관리하거나 검색 로그 기반으로 확장하려면 아래 DB 구조 검토가 필요합니다.

## 6. DB 구조 옵션

### 옵션 A. DB 변경 없음

서버 고정 리스트 또는 설정 파일 기반으로 운영합니다.

장점:

- 가장 빠르게 운영 가능
- 개인정보/검색 로그 저장 리스크 없음
- DBA 작업 없음

단점:

- 실제 사용자 검색 흐름을 반영하지 못함
- 키워드 변경 시 배포 또는 별도 설정 반영이 필요할 수 있음

### 옵션 B. 운영 관리형 인기 검색어 테이블

운영자가 노출 키워드를 직접 관리하는 방식입니다.

추천 상황:

- 검색 로그 기반 집계 전 단계
- 마케팅/운영 정책에 따라 노출 키워드를 조정해야 하는 경우
- 개인정보 리스크 없이 서버 응답 기반 인기 검색어를 제공하고 싶은 경우

검토용 테이블 예시:

```sql
create table nultalk_popular_keyword_manual
(
    nultalk_popular_keyword_manual_id bigint auto_increment primary key,
    target_region varchar(10) not null,
    keyword varchar(100) not null,
    display_order int not null,
    is_active boolean not null default true,
    active_from datetime(6) null,
    active_until datetime(6) null,
    created_at datetime(6) not null,
    updated_at datetime(6) not null
)
    engine = InnoDB collate = utf8mb4_unicode_ci;

create index idx_nultalk_popular_keyword_manual_active
    on nultalk_popular_keyword_manual (target_region, is_active, display_order);
```

검토 포인트:

- `target_region`을 필수로 둘지, 공통 키워드용 `ALL` 또는 `null`을 허용할지
- 같은 리전에서 같은 키워드 중복 등록을 막을지
- 예약 노출 기간이 필요한지
- 관리자 화면 또는 수동 SQL 운영 방식 중 무엇을 택할지

### 옵션 C. 검색어 로그 + 집계 결과 테이블

실제 검색 흐름을 기반으로 인기 검색어를 산출하는 방식입니다.

추천 상황:

- 사용자의 실제 관심사를 반영해야 하는 경우
- 일간/주간/월간 인기 검색어를 분리하려는 경우
- 리전별 인기 검색어가 필요한 경우

#### 검색어 원본 로그 테이블 예시

원본 로그에는 개인정보가 들어갈 수 있으므로 저장 항목을 최소화하는 것을 권장합니다.

```sql
create table nultalk_search_keyword_log
(
    nultalk_search_keyword_log_id bigint auto_increment primary key,
    target_region varchar(10) not null,
    normalized_keyword varchar(100) not null,
    result_count int null,
    searched_at datetime(6) not null
)
    engine = InnoDB collate = utf8mb4_unicode_ci;

create index idx_nultalk_search_keyword_log_region_time
    on nultalk_search_keyword_log (target_region, searched_at);

create index idx_nultalk_search_keyword_log_keyword_time
    on nultalk_search_keyword_log (normalized_keyword, searched_at);
```

개인 식별이 꼭 필요하지 않다면 `account_id`는 저장하지 않는 것을 권장합니다.

중복 사용자 제거가 필요하다면 원본 `account_id` 대신 일 단위 salt를 적용한 비가역 hash 등 개인정보 노출을 줄이는 방식을 검토해 주세요.

#### 집계 결과 테이블 예시

```sql
create table nultalk_popular_keyword_aggregate
(
    nultalk_popular_keyword_aggregate_id bigint auto_increment primary key,
    target_region varchar(10) not null,
    period_type varchar(20) not null,
    period_start datetime(6) not null,
    period_end datetime(6) not null,
    keyword varchar(100) not null,
    search_count bigint not null,
    rank_no int not null,
    is_exposed boolean not null default true,
    aggregated_at datetime(6) not null,
    created_at datetime(6) not null
)
    engine = InnoDB collate = utf8mb4_unicode_ci;

create index idx_nultalk_popular_keyword_aggregate_lookup
    on nultalk_popular_keyword_aggregate (target_region, period_type, period_end, is_exposed, rank_no);

create unique index uk_nultalk_popular_keyword_aggregate_period_keyword
    on nultalk_popular_keyword_aggregate (target_region, period_type, period_start, period_end, keyword);
```

검토 포인트:

- `period_type`: `DAILY`, `WEEKLY`, `ROLLING_7_DAYS` 등
- 앱 API가 어떤 기간의 집계 결과를 읽을지
- 동일 검색어 정규화 기준
- 동률 순위 처리 기준
- 배치 재집계 시 upsert 방식
- 집계 결과 보관 기간

### 옵션 D. 금칙어/숨김 키워드 테이블

검색어 노출 제한을 DB에서 관리하는 방식입니다.

```sql
create table nultalk_search_keyword_blocklist
(
    nultalk_search_keyword_blocklist_id bigint auto_increment primary key,
    keyword varchar(100) not null,
    match_type varchar(20) not null,
    reason varchar(255) null,
    is_active boolean not null default true,
    created_at datetime(6) not null,
    updated_at datetime(6) not null
)
    engine = InnoDB collate = utf8mb4_unicode_ci;

create index idx_nultalk_search_keyword_blocklist_active
    on nultalk_search_keyword_blocklist (is_active, keyword);
```

검토 포인트:

- 완전 일치만 볼지, 부분 일치도 볼지
- 개인정보 패턴은 DB blocklist보다 서버 필터 로직이 적절한지
- 기존 신고/운영 moderation 정책과 통합할 수 있는지

## 7. 검색어 정규화 정책

검색어 로그 또는 집계를 저장한다면 정규화 기준이 필요합니다.

권장 기준:

- 앞뒤 공백 제거
- 연속 공백 1칸으로 축약
- 영문은 소문자 변환
- 너무 짧은 검색어 제외 여부 결정
- 최대 길이 제한
- 이모지, 특수문자, 전화번호, 이메일 등 개인정보성 패턴 처리

원본 검색어를 그대로 저장하면 개인정보 리스크가 커질 수 있습니다. 가능하면 노출 및 집계 기준이 되는 정규화 검색어만 저장하는 방향을 검토해 주세요.

## 8. 보관 기간 제안

최종 보관 기간은 운영/법무/개인정보 정책에 맞춰 결정이 필요합니다.

검토용 제안:

| 데이터 | 제안 보관 기간 | 비고 |
| --- | --- | --- |
| 검색어 원본 로그 | 30일 또는 90일 | 개인정보 리스크를 고려해 짧게 유지 권장 |
| 집계 결과 | 6개월 또는 1년 | 통계 비교 목적이면 장기 보관 가능 |
| 운영 수동 키워드 | 삭제 전까지 | 변경 이력 필요 시 별도 history 검토 |
| 금칙어/숨김 키워드 | 삭제 전까지 | 운영 관리 대상 |

## 9. 성능 검토

앱 조회 API는 검색 화면 진입 시 호출될 수 있으므로 가볍게 유지해야 합니다.

권장 구조:

1. 검색 API 호출 시 검색어 로그를 비동기 또는 별도 경량 경로로 적재
2. 배치 또는 스케줄러가 주기적으로 인기 검색어 집계
3. 집계 결과 테이블 또는 Redis 캐시에 상위 N개 저장
4. `GET /nultalk/search/popular-keywords`는 집계 결과 또는 캐시만 조회

앱 API에서 원본 로그를 직접 group by 하는 방식은 트래픽 증가 시 부담이 커질 수 있어 권장하지 않습니다.

## 10. 결정 필요 항목

- 초기 운영을 서버 고정 리스트로 유지할지, 운영 관리형 테이블로 전환할지
- 실제 검색 로그를 저장할지
- 검색 로그에 사용자 식별자를 저장할지
- 리전별 인기 검색어를 분리할지
- 집계 기간을 무엇으로 할지
- 결과 0건 검색어를 제외할지
- 금칙어/개인정보 필터링을 서버 로직, DB blocklist, 운영 moderation 중 어디에서 처리할지
- 원본 로그와 집계 결과 보관 기간을 어떻게 둘지

## 11. 앱 기준 완료 조건

- `GET /nultalk/search/popular-keywords` 호출 시 200 응답을 받습니다.
- `keywords`가 1개 이상이면 검색 화면의 인기 검색어 칩에 서버 응답을 노출합니다.
- `keywords`가 빈 배열이면 앱 fallback을 노출할 수 있습니다.
- 인기 검색어 칩을 누르면 기존 `GET /nultalk/posts?keyword=` 검색 결과 화면으로 이어집니다.
- 최근 검색어는 기존처럼 기기 로컬 저장만 유지합니다.
