# 운영계 배포 전 체크리스트

이 문서는 `dutying-web`을 운영계(`www.dutying.ai`)에 배포하기 전에 반드시 확인해야 하는 항목을 정리한다.

현재 운영계와 개발계는 배포 구조가 다르다.

| 환경 | 도메인 | 기준 브랜치 | 구조 |
| --- | --- | --- | --- |
| 운영계 | `www.dutying.ai` | `main` | 구 단일 앱 구조 |
| 개발계 | `dev.dutying.ai` | `develop` | pnpm 모노레포 구조 |

따라서 `develop`에서 정상 동작하더라도 운영계에 자동으로 반영된 것으로 보면 안 된다.

## 1. 배포 대상 확인

- Vercel 프로젝트가 어떤 브랜치와 어떤 루트 디렉터리를 보고 있는지 확인한다.
- 운영계 배포가 `main` 기준이면, `develop`의 `apps/*` 아래 변경사항은 운영계에 반영되지 않는다.
- 운영계 hotfix가 필요한 경우 `develop` 전체를 올리지 말고 `main` 기준 hotfix 브랜치를 따로 만든다.

## 2. iOS Universal Links AASA 확인

iOS 앱의 초대 링크와 공유 링크가 Safari가 아니라 앱으로 바로 열리려면 운영 도메인에 AASA 파일이 배포되어 있어야 한다.

필수 URL:

```text
https://www.dutying.ai/.well-known/apple-app-site-association
```

성공 조건:

- `200 OK`
- 리다이렉트 없음
- 인증 없이 접근 가능
- 본문이 HTML이 아니라 JSON
- `Content-Type: application/json` 권장
- 파일명은 `apple-app-site-association` 그대로 사용하고 `.json` 확장자를 붙이지 않음

현재 운영계가 구 `main` 구조라면 파일 위치는 다음과 같다.

```text
public/.well-known/apple-app-site-association
```

`vercel.json`에는 AASA 경로의 Content-Type 헤더를 명시한다.

```json
{
  "headers": [
    {
      "source": "/.well-known/apple-app-site-association",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/json"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

AASA 파일 내용:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "Y4HPW9GX7Y.com.gom3.dutying",
        "paths": [
          "/line-auth/*",
          "/line-auth/",
          "/app/moim/invite",
          "/app/moim/invite/*",
          "/app/friends/invite",
          "/app/friends/invite/*",
          "/app/nultalk/posts/*",
          "/app/wards/*/board/posts/*",
          "/app/notice/*"
        ]
      }
    ]
  }
}
```

검증 명령:

```bash
curl -i https://www.dutying.ai/.well-known/apple-app-site-association
```

정상 응답 예:

```text
HTTP/2 200
content-type: application/json
```

실패 응답 예:

```html
<!DOCTYPE html>
<html lang="ko">
```

위처럼 HTML이 나오면 AASA 파일이 아니라 SPA fallback의 `index.html`이 응답되는 상태다. 이 경우 iOS가 Universal Links 권한을 검증하지 못해 앱 대신 Safari로 열릴 수 있다.

## 3. develop을 운영계로 마이그레이션할 때

나중에 운영계를 `develop`의 모노레포 구조로 전환할 때는 AASA 위치도 운영 배포 앱 기준으로 함께 이전해야 한다.

현재 `develop` 기준 AASA 위치:

```text
apps/landing/public/.well-known/apple-app-site-association
apps/app/public/.well-known/apple-app-site-association
```

마이그레이션 시 확인할 것:

- Vercel의 운영계 루트 디렉터리가 `apps/landing`인지 `apps/app`인지 확인한다.
- 운영계가 실제로 서빙하는 앱의 `public/.well-known/apple-app-site-association`을 유지한다.
- 해당 앱의 `vercel.json`에 AASA `Content-Type` 헤더가 포함되어 있는지 확인한다.
- 구 `main` 루트의 `public/.well-known/apple-app-site-association`이 더 이상 쓰이지 않는다면 제거 여부를 별도로 판단한다.

## 4. 모바일팀 재검증 요청

웹 배포 완료 후 모바일팀에 다음 항목을 전달한다.

- AASA 운영계 배포 완료 여부
- `curl -i` 검증 결과
- iOS는 AASA 파일을 캐싱할 수 있으므로 앱 재설치 또는 일정 시간 후 재검증이 필요할 수 있다는 점

모바일팀 검증 예:

```bash
xcrun simctl openurl booted "https://www.dutying.ai/app/moim/invite?code=PXZ7XE"
```

관련 문서:

- `docs/universal-links-aasa.md`
