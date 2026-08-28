# 랜딩 성능 비교 — 2026-08-28

## 측정 조건

- 변경 전: Vite 프로덕션 빌드의 React 랜딩(`/`)
- 변경 후: Astro 프로덕션 빌드의 정적 랜딩(`/`)
- Lighthouse: 12.8.2 기본 모바일 프로필, Chrome for Testing 142, Performance/Accessibility/Best Practices/SEO
- Chrome Network: 모바일 뷰포트 390 × 844, 캐시 비활성화, `Network.loadingFinished.encodedDataLength` 합계
- 두 측정 모두 로컬 프로덕션 프리뷰를 사용했다.

## 모바일 Lighthouse

| 항목           |    변경 전 |  변경 후 |       변화 |
| -------------- | ---------: | -------: | ---------: |
| Performance    |         62 |       99 |      +37점 |
| Accessibility  |        100 |      100 |       유지 |
| Best Practices |         96 |      100 |       +4점 |
| SEO            |        100 |      100 |       유지 |
| FCP            |     5.40초 |   0.75초 | 86.1% 감소 |
| LCP            |     7.40초 |   2.25초 | 69.5% 감소 |
| TBT            |       21ms |      0ms |  100% 감소 |
| CLS            |          0 |        0 |       유지 |
| 전송량         | 1,175,201B | 270,494B | 77.0% 감소 |

## Chrome Network

| 항목                  |           변경 전 |        변경 후 |                       변화 |
| --------------------- | ----------------: | -------------: | -------------------------: |
| 초기 전체 요청        | 57개 / 1,975,709B | 9개 / 212,118B |          전송량 89.3% 감소 |
| 초기 JavaScript       |   25개 / 646,319B |       0개 / 0B |                  100% 감소 |
| 초기 이미지           |   15개 / 960,317B | 7개 / 206,070B |          전송량 78.5% 감소 |
| 스크롤 후 추가 이미지 |          0개 / 0B |  2개 / 58,376B | 하단 이미지 지연 로드 확인 |

변경 후 첫 화면 이미지는 `fetchpriority="high"`와 반응형 preload로 우선 처리한다. 기능 이미지는 모두 `loading="lazy"`이며, Chrome의 근접 뷰포트 휴리스틱에 따라 첫 두 기능 이미지는 초기 유휴 구간에 로드되고 더 아래의 웹 기능 이미지 2개는 스크롤 후 요청됐다.

## 번들·검색 검증

- 제품 앱의 프로덕션 HTML에 `modulepreload` 링크가 없다.
- `@tanstack/react-query-devtools`는 앱 manifest, lockfile, 프로덕션 산출물에 없다.
- 정적 홈페이지는 JavaScript를 전송하지 않는다.
- `app.dutying.ai/`는 배포 설정에서 `https://www.dutying.ai`로 영구 리다이렉트하며 React 랜딩 모듈은 제품 앱 라우터에서 제거됐다.
- 홈페이지 JSON-LD에는 `Organization`, `WebSite`, `SoftwareApplication`이 연결된 `@graph`로 포함된다.
- 제품 앱 문서는 `noindex, follow`, 공개 랜딩은 canonical과 sitemap을 갖는다.
