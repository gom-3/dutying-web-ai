# 앱 팝업 지역별 콘텐츠 관리자/백엔드 요건

작성일: 2026-08-21

## 배경

앱에서 운영 공지, 이벤트, 신규 기능 안내 등을 인앱 팝업으로 노출할 수 있어야 합니다.

현재 앱 운영 대상 언어/지역은 아래 3개로 봅니다.

| 운영 구분 | `serviceRegion` | `preferredLanguage` | 표시 locale |
| --- | --- | --- | --- |
| 한국어 | `KR` | `ko` | `ko-KR` |
| 일본 | `JP` | `ja` | `ja-JP` |
| 영어권 | `EN` | `en` | `en-US` |

관리자는 하나의 팝업 캠페인 안에서 한국어/일본어/영어 콘텐츠를 각각 작성할 수 있어야 합니다.
앱은 사용자 계정의 지역/언어에 맞는 콘텐츠만 받아서 노출합니다.

## 결론

팝업은 "하나의 캠페인 + 지역별 콘텐츠 3개" 구조로 만듭니다.

예:

```text
app_popup
  - 노출 기간, 활성화 여부, 우선순위, 노출 빈도, 대상 조건

app_popup_content
  - KR/ko 제목, 본문, 이미지, CTA
  - JP/ja 제목, 본문, 이미지, CTA
  - EN/en 제목, 본문, 이미지, CTA
```

v1에서는 `KR`, `JP`, `EN`만 지원합니다. 서버 enum에는 `CN`, `TH`, `VN`이 있더라도 앱 팝업 관리자 화면과 API는 후속 확장 전까지 3개만 허용합니다.

## 관리자 화면 요건

### 목록

관리자 페이지는 팝업 목록에서 아래 정보를 보여줍니다.

| 항목 | 설명 |
| --- | --- |
| 내부 제목 | 관리자 식별용 이름 |
| 상태 | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| 활성화 | ON/OFF 토글 |
| 노출 기간 | `startAt` ~ `endAt` |
| 대상 지역 | KR, JP, EN |
| 콘텐츠 완성도 | 예: `3/3`, `2/3` |
| 우선순위 | 동시 노출 시 정렬 기준 |
| 통계 | 노출, 클릭, 닫기 수 |

### 작성/수정

관리자 작성 화면은 공통 설정과 지역별 콘텐츠 탭으로 나눕니다.

공통 설정:

| 항목 | 필수 | 설명 |
| --- | --- | --- |
| 내부 제목 | Y | 관리자 목록/검색용. 앱에는 노출하지 않음 |
| 상태 | Y | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| 활성화 여부 | Y | 즉시 끄기용 kill switch |
| 노출 시작일 | Y | KST 기준 datetime |
| 노출 종료일 | N | 비우면 수동 종료 전까지 노출 |
| 대상 플랫폼 | Y | v1은 `APP` 기본. 필요하면 `ALL`, `WEB` 확장 |
| 대상 지역 | Y | v1은 `KR`, `JP`, `EN` 중 1개 이상 |
| 노출 빈도 | Y | `ONCE`, `ONCE_PER_DAY`, `EVERY_SESSION` |
| 사용자별 최대 노출 수 | N | `ONCE`면 1로 해석 |
| 우선순위 | Y | 숫자가 높을수록 먼저 노출 |

지역별 콘텐츠 탭:

| 탭 | 저장 값 |
| --- | --- |
| 한국어 | `targetRegion=KR`, `language=ko` |
| 日本語 | `targetRegion=JP`, `language=ja` |
| English | `targetRegion=EN`, `language=en` |

각 콘텐츠 항목:

| 항목 | 필수 | 설명 |
| --- | --- | --- |
| 팝업 제목 | Y | 앱에 표시 |
| 본문 | Y | 앱에 표시 |
| 이미지 | N | 지역별로 다른 이미지 가능 |
| CTA 버튼 문구 | N | 지역별 문구. 예: 확인하기 / View / 詳細を見る |
| CTA URL | N | 앱 내부 경로 또는 HTTPS 외부 링크 |
| 보조 버튼 문구 | N | v1은 닫기 버튼 기본 제공이므로 생략 가능 |

### 게시 검증

`PUBLISHED`로 저장하거나 `enabled=true`로 켤 때 아래 조건을 검증합니다.

- 대상 지역에 포함된 모든 지역의 콘텐츠가 존재해야 합니다.
- 각 콘텐츠의 제목과 본문은 비어 있으면 안 됩니다.
- CTA URL이 있으면 CTA 버튼 문구도 있어야 합니다.
- CTA 버튼 문구가 있으면 CTA URL도 있어야 합니다.
- 앱 내부 URL은 허용된 route prefix만 허용합니다.
- 외부 URL은 `https://`만 허용합니다.
- 노출 종료일이 있으면 시작일보다 이후여야 합니다.

중요: 특정 지역 콘텐츠가 빠져 있으면 해당 지역에 다른 언어 콘텐츠를 fallback으로 보여주지 않습니다. 운영자가 실수로 한국어 팝업을 영어권 사용자에게 노출하는 상황을 막기 위함입니다.

## 앱 노출 정책

앱은 로그인 이후 홈 또는 주요 앱 shell 진입 시 eligible 팝업을 조회합니다.

서버는 아래 순서로 사용자 노출 언어/지역을 결정합니다.

1. 로그인 계정의 `serviceRegion`이 있으면 우선 사용합니다.
2. 계정 지역이 없으면 `X-Service-Region` 헤더를 사용합니다.
3. 지역이 없으면 `Accept-Language`에서 `ko`, `ja`, `en`을 판정합니다.
4. 그래도 없으면 `EN/en`으로 봅니다.

계정의 `preferredLanguage`가 있다면 콘텐츠 선택에 함께 사용할 수 있지만, v1에서는 지역과 언어가 1:1로 묶입니다.

| `serviceRegion` | 반환 콘텐츠 |
| --- | --- |
| `KR` | `language=ko` 콘텐츠 |
| `JP` | `language=ja` 콘텐츠 |
| `EN` | `language=en` 콘텐츠 |

노출 조건:

- `status=PUBLISHED`
- `enabled=true`
- 현재 시각이 `startAt` 이후
- `endAt`이 없거나 현재 시각이 `endAt` 이전
- 요청 플랫폼이 대상 플랫폼과 일치
- 사용자 지역이 대상 지역에 포함
- 해당 지역 콘텐츠가 존재
- 사용자별 노출 빈도 제한을 통과

여러 팝업이 조건을 만족하면 `priority desc`, `startAt desc`, `popupId desc` 순으로 1개만 반환합니다.

## 앱 UI 정책

- 한 번에 팝업은 1개만 보여줍니다.
- 닫기 버튼은 항상 제공합니다.
- `오늘 하루 보지 않기`는 `ONCE_PER_DAY` 팝업에서 제공할 수 있습니다.
- 이미지 로딩 실패 시 텍스트와 CTA만 보여줍니다.
- CTA 클릭 시 이벤트를 기록한 뒤 이동합니다.
- 앱 내부 URL은 현재 라우터로 이동하고, 외부 HTTPS URL은 외부 브라우저 또는 인앱 브라우저 정책을 따릅니다.
- 모달은 접근성 기준에 맞춰 `role=dialog`, `aria-modal=true`, 제목 연결, 포커스 이동/복귀, ESC/뒤로가기 닫기를 지원합니다.

## API 요청

### 관리자 팝업 목록

```http
GET /admin/app-popups?status=PUBLISHED&enabled=true&page=0&size=20
```

### 관리자 팝업 생성

```http
POST /admin/app-popups
Content-Type: application/json
```

```json
{
  "internalTitle": "2026-08 신규 기능 안내",
  "status": "DRAFT",
  "enabled": false,
  "platform": "APP",
  "targetRegions": ["KR", "JP", "EN"],
  "frequencyType": "ONCE_PER_DAY",
  "maxImpressionsPerUser": 3,
  "priority": 100,
  "startAt": "2026-08-22T09:00:00",
  "endAt": "2026-08-31T23:59:59",
  "contents": [
    {
      "targetRegion": "KR",
      "language": "ko",
      "title": "새로운 기능이 추가됐어요",
      "body": "이번 달 근무표 확인 화면이 개선되었습니다.",
      "imageUrl": "https://cdn.example.com/popups/feature-ko.png",
      "ctaLabel": "확인하기",
      "ctaUrl": "/duty"
    },
    {
      "targetRegion": "JP",
      "language": "ja",
      "title": "新機能が追加されました",
      "body": "今月の勤務表確認画面が改善されました。",
      "imageUrl": "https://cdn.example.com/popups/feature-ja.png",
      "ctaLabel": "確認する",
      "ctaUrl": "/duty"
    },
    {
      "targetRegion": "EN",
      "language": "en",
      "title": "New feature update",
      "body": "The monthly duty roster view has been improved.",
      "imageUrl": "https://cdn.example.com/popups/feature-en.png",
      "ctaLabel": "View",
      "ctaUrl": "/duty"
    }
  ]
}
```

### 관리자 팝업 수정

```http
PUT /admin/app-popups/{popupId}
Content-Type: application/json
```

생성 요청과 같은 body를 사용합니다. `contents`는 전달된 전체 콘텐츠 세트로 교체하거나, 서버 구현 편의상 upsert 방식으로 처리할 수 있습니다. 단, 응답은 항상 전체 콘텐츠를 반환합니다.

### 활성화 토글

```http
PATCH /admin/app-popups/{popupId}/enabled
Content-Type: application/json
```

```json
{
  "enabled": true
}
```

`enabled=true` 요청 시 게시 검증을 다시 수행합니다.

### 앱 eligible 팝업 조회

```http
GET /app-popups/eligible?platform=APP
Accept-Language: ko-KR
X-Service-Region: KR
Authorization: Bearer ...
```

#### Response 200

노출할 팝업이 있는 경우:

```json
{
  "popupId": 123,
  "contentId": 456,
  "targetRegion": "KR",
  "language": "ko",
  "title": "새로운 기능이 추가됐어요",
  "body": "이번 달 근무표 확인 화면이 개선되었습니다.",
  "imageUrl": "https://cdn.example.com/popups/feature-ko.png",
  "ctaLabel": "확인하기",
  "ctaUrl": "/duty",
  "frequencyType": "ONCE_PER_DAY",
  "eventToken": "opaque-event-token"
}
```

노출할 팝업이 없는 경우:

```json
{
  "popup": null
}
```

### 이벤트 기록

```http
POST /app-popups/{popupId}/events
Content-Type: application/json
```

```json
{
  "contentId": 456,
  "eventToken": "opaque-event-token",
  "eventType": "IMPRESSION"
}
```

`eventType`:

| 값 | 의미 |
| --- | --- |
| `IMPRESSION` | 실제 화면에 팝업이 표시됨 |
| `CLICK` | CTA 클릭 |
| `DISMISS` | 닫기 |
| `HIDE_TODAY` | 오늘 하루 보지 않기 |

## DB 제안

### `app_popup`

| column | description |
| --- | --- |
| `app_popup_id` | PK |
| `internal_title` | 관리자 식별용 제목 |
| `status` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `enabled` | 활성화 여부 |
| `platform` | `APP`, `WEB`, `ALL` |
| `frequency_type` | `ONCE`, `ONCE_PER_DAY`, `EVERY_SESSION` |
| `max_impressions_per_user` | 사용자별 최대 노출 수 |
| `priority` | 우선순위 |
| `start_at` | 노출 시작 시각 |
| `end_at` | 노출 종료 시각 |
| `created_by` | 생성 관리자 계정 ID |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

### `app_popup_content`

| column | description |
| --- | --- |
| `app_popup_content_id` | PK |
| `app_popup_id` | FK |
| `target_region` | `KR`, `JP`, `EN` |
| `language` | `ko`, `ja`, `en` |
| `title` | 지역별 제목 |
| `body` | 지역별 본문 |
| `image_url` | 지역별 이미지 URL |
| `cta_label` | 지역별 CTA 문구 |
| `cta_url` | 지역별 CTA URL |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

Unique key:

```sql
(app_popup_id, target_region)
```

### `app_popup_target_region`

대상 지역을 별도 테이블로 관리하거나 `app_popup_content.target_region`으로 대체할 수 있습니다.

v1에서 "콘텐츠가 있는 지역이 곧 대상 지역"이면 별도 테이블 없이 단순하게 갈 수 있습니다.
다만 초안 저장 중 콘텐츠는 있지만 아직 대상에서 제외하는 운영이 필요하면 별도 테이블을 둡니다.

| column | description |
| --- | --- |
| `app_popup_id` | FK |
| `target_region` | `KR`, `JP`, `EN` |

Unique key:

```sql
(app_popup_id, target_region)
```

### `app_popup_event`

| column | description |
| --- | --- |
| `app_popup_event_id` | PK |
| `app_popup_id` | FK |
| `app_popup_content_id` | FK |
| `account_id` | 사용자 계정 ID |
| `device_id` | 선택. 비로그인/기기 기준 확장용 |
| `target_region` | 이벤트 발생 시 반환된 지역 |
| `language` | 이벤트 발생 시 반환된 언어 |
| `event_type` | `IMPRESSION`, `CLICK`, `DISMISS`, `HIDE_TODAY` |
| `event_date` | KST 기준 날짜. 일별 제한 조회용 |
| `created_at` | 발생 시각 |

권장 인덱스:

```sql
(account_id, app_popup_id, event_type, created_at)
(account_id, app_popup_id, event_date, event_type)
(app_popup_id, target_region, language, event_type, created_at)
```

## 검증 규칙

- `internalTitle`: 필수, 최대 80자
- `title`: 필수, 최대 80자
- `body`: 필수, 최대 500자
- `imageUrl`: 선택, 최대 2048자, HTTPS URL
- `ctaLabel`: 선택, 최대 30자
- `ctaUrl`: 선택, 최대 2048자
- `targetRegions`: v1은 `KR`, `JP`, `EN`만 허용
- `language`: v1은 `ko`, `ja`, `en`만 허용
- `targetRegion=KR`이면 `language=ko`
- `targetRegion=JP`이면 `language=ja`
- `targetRegion=EN`이면 `language=en`
- `priority`: 정수
- `maxImpressionsPerUser`: 1 이상 정수 또는 null

## 관리자 권한

- 병동 관리자용 화면과 분리된 운영 관리자 권한이 필요합니다.
- 최소 권한은 앱 전체 공지/마케팅 발송 권한과 같은 레벨로 봅니다.
- 생성/수정/활성화/보관/삭제는 audit log를 남깁니다.

## 기존 기능과의 관계

- 이 기능은 `/notifications` row나 FCM push를 생성하지 않습니다.
- 알림함에 남는 공지와 별개로, 앱 화면 위에 뜨는 인앱 메시지입니다.
- 관리자 브로드캐스트의 `targetRegion`, `targetLanguage` 필터 개념은 재사용할 수 있지만, 팝업은 지역별 콘텐츠를 한 캠페인 안에 저장한다는 점이 다릅니다.
- 공지사항 `notice.target_region`, `notice.target_language`와도 개념은 비슷하지만, 팝업은 노출 빈도/닫기 기록/클릭 통계가 필수입니다.

## 후속 확장

- `CN/zh`, `TH/th`, `VN/vi` 콘텐츠 탭 추가
- 특정 앱 버전 이상/이하 대상 조건
- 특정 병동/계정/테스트 그룹 대상
- A/B 테스트
- 관리자 미리보기 QR 또는 preview token
- 팝업 이미지 자동 리사이징
- 다중 팝업 큐

## 참고 기준

- Firebase In-App Messaging은 캠페인별 대상, 스케줄, 트리거, per-device frequency limit을 둡니다.
- OneSignal In-App Messages는 앱 시작 시 대상/트리거/스케줄/빈도를 만족하는 메시지를 노출하고, 노출/클릭/닫기 통계를 봅니다.
- WAI-ARIA modal dialog 패턴은 모달이 열릴 때 포커스 이동, 포커스 trap, ESC 닫기, `aria-modal=true`를 요구합니다.
