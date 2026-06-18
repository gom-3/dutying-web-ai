# 마이페이지 화면 언어 설정 백엔드 요청

## 요약

프론트 마이페이지에서는 사용자가 **화면 언어**만 선택합니다.

다만 서비스 지역은 화면에 따로 노출하지 않고, 선택한 언어에 맞춰 프론트가 자동으로 함께 저장 요청을 보냅니다.

| 화면 언어 | 저장할 `preferredLanguage` | 저장할 `serviceRegion` |
| --- | --- | --- |
| 한국어 | `ko` | `KR` |
| 일본어 | `ja` | `JP` |
| 영어 | `en` | `EN` |

## 쉽게 설명

사용자가 마이페이지에서 언어를 일본어로 바꾸면, 화면에는 언어 드롭다운만 보입니다.

하지만 프론트는 백엔드에 아래처럼 언어와 서비스 지역을 같이 보냅니다.

```http
PATCH /accounts/me/preferences
Content-Type: application/json
```

```json
{
  "preferredLanguage": "ja",
  "serviceRegion": "JP"
}
```

즉, 사용자가 직접 서비스 지역을 고르지는 않지만 내부적으로는 `일본어 = 일본 서비스 지역`으로 맞춰 저장합니다.

## 프론트 변경 내용

- 마이페이지 설정 UI에서 `서비스 지역` 드롭다운을 제거했습니다.
- 사용자는 `화면 언어`만 선택할 수 있습니다.
- 저장 시 프론트가 언어에 맞는 서비스 지역을 자동으로 계산해서 같이 전송합니다.
- 저장 성공 후 프론트는 즉시 `i18n.changeLanguage(...)`로 화면 언어를 변경합니다.
- 저장 성공 후 프론트 로컬 서비스 지역 값도 같은 값으로 갱신합니다.

## 요청 API

```http
PATCH /accounts/me/preferences
```

### 요청 바디

```ts
type UpdateAccountPreferencesRequest = {
  preferredLanguage?: 'ko' | 'ja' | 'en' | null;
  serviceRegion?: 'KR' | 'JP' | 'EN' | null;
};
```

마이페이지 언어 설정 저장 시 프론트는 두 값을 함께 보냅니다.

### 예시

한국어 선택:

```json
{
  "preferredLanguage": "ko",
  "serviceRegion": "KR"
}
```

일본어 선택:

```json
{
  "preferredLanguage": "ja",
  "serviceRegion": "JP"
}
```

영어 선택:

```json
{
  "preferredLanguage": "en",
  "serviceRegion": "EN"
}
```

## 기대 동작

- 백엔드는 요청으로 온 `preferredLanguage`를 저장합니다.
- 백엔드는 요청으로 온 `serviceRegion`도 저장합니다.
- `GET /accounts/me` 응답에는 저장된 `preferredLanguage`와 `serviceRegion`을 내려줍니다.

## 백엔드 구현 시 주의점

프론트는 마이페이지 저장 시 두 값을 같이 보내지만, API 타입상 두 필드는 optional입니다.

따라서 다른 클라이언트나 이전 버전 앱에서 일부 필드만 보낼 가능성을 고려한다면, 요청에 포함된 필드만 업데이트하는 PATCH 방식이 안전합니다.

```ts
if (body.preferredLanguage !== undefined) {
  account.preferredLanguage = body.preferredLanguage;
}

if (body.serviceRegion !== undefined) {
  account.serviceRegion = body.serviceRegion;
}
```

## 결론

새 API는 필요 없습니다. 기존 `PATCH /accounts/me/preferences`에서 `preferredLanguage`와 `serviceRegion`을 함께 저장할 수 있으면 됩니다.

