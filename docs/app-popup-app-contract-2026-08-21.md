# 앱 팝업 앱 연동 계약

작성일: 2026-08-21

## 요약

관리자 페이지에서 등록한 앱 팝업을 앱 로그인 이후 화면 진입 시 조회해 노출합니다.

팝업은 푸시 알림이나 알림함 row가 아닙니다. 앱 내부 모달로만 표시하며, 사용자별 노출 제한은 서버의 이벤트 기록을 기준으로 판단합니다.

## 지원 지역/언어

v1은 아래 3개 콘텐츠만 지원합니다.

| 지역 | 언어 | locale |
| --- | --- | --- |
| `KR` | `ko` | `ko-KR` |
| `JP` | `ja` | `ja-JP` |
| `EN` | `en` | `en-US` |

서버는 사용자 계정의 `serviceRegion`을 우선 사용합니다.
계정 지역이 없으면 `X-Service-Region`, 인프라 지역 헤더, `Accept-Language`를 참고해 `KR`, `JP`, `EN` 중 하나로 정규화합니다.

중요: 서버는 다른 언어 콘텐츠로 fallback하지 않습니다. 예를 들어 `JP/ja` 콘텐츠가 없으면 일본 대상 사용자에게 해당 팝업을 내려주지 않습니다.

## Eligible 팝업 조회

앱은 로그인 완료 후 홈 또는 앱 shell 진입 시 아래 API를 호출합니다.

```http
GET /app-popups/eligible?platform=APP
Authorization: Bearer {accessToken}
Accept-Language: ko-KR
X-Service-Region: KR
```

`platform`은 아래 값을 허용합니다.

| 값 | 설명 |
| --- | --- |
| `APP` | 앱 공통. 서버에서 `MOBILE`로 처리 |
| `MOBILE` | iOS/AOS 공통 |
| `IOS` | iOS |
| `AOS` | Android |
| `ANDROID` | 서버에서 `AOS`로 처리 |

앱에서는 우선 `APP` 또는 실제 OS에 맞춰 `IOS`/`AOS`를 보내면 됩니다.

### 노출할 팝업이 있는 경우

```json
{
  "popup": {
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
    "maxImpressionsPerUser": 3,
    "eventToken": "8c59b6b6-..."
  }
}
```

### 노출할 팝업이 없는 경우

```json
{
  "popup": null
}
```

## 앱 렌더링 정책

- 한 번에 팝업은 1개만 표시합니다.
- `popup=null`이면 아무것도 표시하지 않습니다.
- 이미지가 있으면 모달 상단 또는 본문 영역에 표시합니다.
- 이미지 로딩 실패 시 팝업 자체를 실패 처리하지 말고 제목/본문/CTA만 표시합니다.
- 닫기 버튼은 항상 제공해야 합니다.
- `ctaLabel`과 `ctaUrl`은 함께 내려옵니다. 둘 다 없으면 CTA 버튼을 표시하지 않습니다.
- `ctaUrl`이 `/`로 시작하면 앱 내부 라우팅으로 처리합니다.
- `ctaUrl`이 `https://`로 시작하면 외부 브라우저 또는 앱의 외부 링크 정책을 따릅니다.

## 이벤트 기록

eligible 응답만으로는 노출 처리되지 않습니다.
앱이 실제로 모달을 렌더링한 뒤 `IMPRESSION`을 반드시 기록해야 사용자별 노출 제한이 적용됩니다.

```http
POST /app-popups/{popupId}/events
Authorization: Bearer {accessToken}
Content-Type: application/json
```

```json
{
  "contentId": 456,
  "eventToken": "8c59b6b6-...",
  "eventType": "IMPRESSION"
}
```

이벤트 유형:

| eventType | 호출 시점 |
| --- | --- |
| `IMPRESSION` | 팝업 모달이 실제 화면에 표시된 직후 |
| `CLICK` | CTA 버튼 클릭 직후. 이동 전에 호출 권장 |
| `DISMISS` | 닫기 버튼 또는 뒤로가기/ESC로 닫힘 |
| `HIDE_TODAY` | 오늘 하루 보지 않기 선택 |

`contentId`와 `eventToken`은 eligible 응답값을 그대로 전달합니다.

## 노출 제한 동작

서버는 이벤트 기록을 기준으로 다음 호출의 eligible 결과를 결정합니다.

| frequencyType | 서버 동작 |
| --- | --- |
| `ONCE` | 사용자별 `IMPRESSION`이 1회라도 있으면 다시 내려주지 않음 |
| `ONCE_PER_DAY` | KST 기준 당일 `IMPRESSION` 또는 `HIDE_TODAY`가 있으면 다시 내려주지 않음 |
| `EVERY_SESSION` | 서버 빈도 제한 없음. 단 `maxImpressionsPerUser`가 있으면 그 수까지만 노출 |

`maxImpressionsPerUser`가 있으면 모든 빈도 타입에서 사용자별 누적 `IMPRESSION` 수가 해당 값 이상일 때 내려주지 않습니다.

## 권장 호출 흐름

1. 로그인 완료
2. 홈 또는 앱 shell 진입
3. `GET /app-popups/eligible?platform=APP`
4. `popup`이 있으면 모달 렌더링
5. 렌더링 성공 직후 `IMPRESSION`
6. CTA 클릭 시 `CLICK` 기록 후 이동
7. 닫기 시 `DISMISS`
8. 오늘 하루 보지 않기 시 `HIDE_TODAY`

## 접근성/UX

- 모달 제목은 `title`을 사용합니다.
- 스크린리더에서 제목과 본문이 읽히도록 dialog label/description을 연결합니다.
- Android back button 또는 iOS swipe dismiss 정책은 앱 공통 모달 정책을 따릅니다.
- 닫기 후에는 팝업을 열기 전 화면 상태로 돌아갑니다.

## 서버 구현 상태

반영된 서버 파일:

- `dutying-server/src/main/java/com/gom3/dutying/domain/appPopup/api/AppPopupController.java`
- `dutying-server/src/main/java/com/gom3/dutying/domain/appPopup/service/AppPopupService.java`
- `dutying-server/src/main/resources/db/migration/V87__app_popup_localized_content.sql`

관리자 페이지:

- `/admin/app-popups/page`
- 이미지 첨부: `POST /admin/app-popups/images` multipart 업로드 후 응답 `imageUrl`을 지역별 콘텐츠에 저장
