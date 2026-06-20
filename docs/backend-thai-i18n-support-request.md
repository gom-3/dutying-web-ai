# 태국어 국제화 백엔드 요청

## 요약

웹 프론트에 태국어 화면 언어를 추가했습니다.

백엔드에는 새 API가 필요하지 않지만, 기존 언어/지역 저장 및 요청 헤더 처리에서 태국어 값을 허용해야 합니다.

| 화면 언어 | 저장할 `preferredLanguage` | 저장할 `serviceRegion` | API `Accept-Language` | API `X-Service-Region` |
| --- | --- | --- | --- | --- |
| 한국어 | `ko` | `KR` | `ko-KR` | `KR` |
| 일본어 | `ja` | `JP` | `ja-JP` | `JP` |
| 영어 | `en` | `EN` | `en-US` | `EN` |
| 중국어(간체) | `zh` | `CN` | `zh-CN` | `CN` |
| 태국어 | `th` | `TH` | `th-TH` | `TH` |

## 프론트 변경 내용

- 지원 언어에 `th`를 추가했습니다.
- 지원 서비스 지역에 `TH`를 추가했습니다.
- 마이페이지 언어 선택에서 `ภาษาไทย`를 선택할 수 있습니다.
- 태국어 선택 후 저장 시 기존 선호 설정 API로 아래 값을 전송합니다.

```http
PATCH /accounts/me/preferences
Content-Type: application/json
```

```json
{
  "preferredLanguage": "th",
  "serviceRegion": "TH"
}
```

- 이후 모든 API 요청에는 아래 헤더가 붙습니다.

```http
Accept-Language: th-TH
X-Service-Region: TH
```

## 백엔드 필수 구현

### 1. 계정 선호 언어/지역 enum 허용값 추가

기존 타입이 아래처럼 확장되어야 합니다.

```ts
type PreferredLanguage = 'ko' | 'ja' | 'en' | 'zh' | 'th';
type ServiceRegion = 'KR' | 'JP' | 'EN' | 'CN' | 'TH';
```

확인 대상:

- `PATCH /accounts/me/preferences` 요청 DTO validation
- 계정 도메인 enum 또는 value object
- DB enum, check constraint, column validation이 있다면 `th`, `TH` 추가
- `GET /accounts/me` 응답의 `preferredLanguage`, `serviceRegion`
- `resolvedLanguage`, `resolvedRegion`을 내려주는 로직이 있다면 `th`, `TH`도 반환 가능해야 함

### 2. Locale / region resolver 확장

백엔드는 아래 값을 reject하지 않아야 합니다.

- `preferredLanguage: "th"`
- `serviceRegion: "TH"`
- `Accept-Language: th-TH`
- `X-Service-Region: TH`

권장 정규화:

```text
th, th-TH, th_TH -> th / th-TH
TH, th -> TH
```

태국 전용 비즈니스 규칙이 아직 없다면 `TH`를 저장/응답은 하되, 내부 정책은 기존 글로벌(`EN`)과 동일하게 fallback해도 됩니다.

### 3. 서버 메시지 번역 파일

백엔드가 `messageKey` 기반으로만 내려주고 프론트가 번역하면 필수는 아닙니다.

다만 서버 응답의 `message`도 locale에 맞춰 내려주는 정책이라면 태국어 메시지 파일을 추가해 주세요.

예상 파일명:

```text
messages_th.properties
```

응답 예시:

```json
{
  "code": "INVALID_TYPE_VALUE",
  "messageKey": "error.invalidTypeValue",
  "displayPolicy": "CLIENT_TRANSLATE",
  "locale": "th-TH"
}
```

## 테스트 요청

### 선호 설정 저장

```http
PATCH /accounts/me/preferences
Content-Type: application/json
```

```json
{
  "preferredLanguage": "th",
  "serviceRegion": "TH"
}
```

기대:

- 2xx 응답
- `GET /accounts/me`에서 `preferredLanguage: "th"`, `serviceRegion: "TH"` 반환

### 태국어 헤더 요청

```http
GET /accounts/me
Accept-Language: th-TH
X-Service-Region: TH
```

기대:

- locale/region parser에서 에러가 나지 않음
- 응답의 locale 관련 필드가 있다면 `th-TH` 기준으로 처리

## 프론트 기준 파일

- `packages/domain/src/account.ts`
- `apps/app/src/shared/i18n/locale.ts`
- `apps/app/i18n/catalog/messages.csv`
- `apps/app/src/shared/i18n/resources.generated.ts`

## 결론

새 API는 필요 없습니다.

기존 계정 선호 설정 API와 locale header 처리에서 `th`, `TH`, `th-TH`을 허용하면 프론트 태국어 국제화가 정상 동작합니다.
