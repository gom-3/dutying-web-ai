# Dutying `.ai` 인프라 핵심 가이드 — DNS · Cloudflare · SEO

> 2026-08 `.net` → `.ai` 이전을 하며 확정한 구조와, 삽질 끝에 배운 규칙들.
> 상세한 이전 과정·경위는 `cutover-status.md` 참조. 이 문서는 **현재 구조와 운영 규칙**만 담는다.

---

## 1. 전체 그림

```
                        Namecheap (도메인 등록)
                              │  NS 위임
                              ▼
                     Cloudflare DNS (zone: dutying.ai)
                              │
   ┌──────────┬──────────┬────┴─────┬───────────┬───────────┐
   ▼          ▼          ▼          ▼           ▼           ▼
 dutying.ai  www        app        dev         docs      api / dev.api
 (301→www)  ┌─────────────────────────────┐  ┌────────┐  ┌──────────┐
            │ Cloudflare Pages (4 프로젝트) │  │ Pages  │  │ EC2 (A)  │
            └─────────────────────────────┘  └────────┘  └──────────┘
```

- **웹 4개 = Cloudflare Pages** (레포 `gom-3/dutying-web-ai` 하나에서 빌드 타깃만 다름)
- **API = EC2** (A 레코드 직결, `gom-3/dutying-server-ai`)
- **메일 = Zoho** (MX·SPF는 DNS에만 있고 웹과 무관)

## 2. 호스트 ↔ 앱 매핑 (제일 자주 헷갈리는 것)

| 호스트 | 서빙 | Pages 프로젝트 | 브랜치 | 색인 |
| --- | --- | --- | --- | --- |
| `dutying.ai` | 301 → www | (없음 — Redirect Rule) | — | — |
| `www.dutying.ai` | **앱** (`apps/app`, 랜딩 포함) | `dutying-web-ai` | `main` | ✅ index |
| `app.dutying.ai` | 같은 앱 (호환용) | `dutying-web-ai` | `main` | canonical→www |
| `dev.dutying.ai` | 같은 앱 (dev) | `dutying-web-ai-dev` | `develop` | ❌ noindex |
| `docs.dutying.ai` | VitePress (`apps/docs`) | `dutying-docs` | `main` | ✅ |
| `api.dutying.ai` | 백엔드 prod | — (EC2 43.202.216.112) | — | — |
| `dev.api.dutying.ai` | 백엔드 dev | — (EC2 3.36.210.125) | — | — |

**규칙들:**

- **앱의 정식 주소는 `www`다.** apex는 Redirect Rule로 301, `app.`은 딥링크·구 주소 호환으로 유지하되 canonical은 www로 모은다. 서버(`dutying-server-ai`)의 OAuth `default-url`도 `https://www.dutying.ai/`로 이 구조를 전제한다.
- **`apps/landing`(Astro)은 은퇴했다.** 2026-03 분리 시도가 06-20에 멈춘 스냅샷. 도메인 안 붙어 있고 robots `Disallow`. 랜딩은 앱 안(`apps/app/src/pages/landing/`, 6개 언어)이 정식이다.
- **한 호스트는 한 Pages 프로젝트에만 붙는다.** 옮기려면 떼었다 붙여야 하고 그 사이 사이트가 내려간다 (수 분).

## 3. DNS (Cloudflare zone)

### 왜 NS를 Cloudflare로 넘겼나

Pages 커스텀 도메인은 외부 DNS CNAME으로도 되지만, **zone apex(`dutying.ai`)는 CNAME이 불가**(DNS 스펙)라서 apex를 살리려면 NS 위임이 필요했다. 위임 후 CNAME flattening + Redirect Rule로 해결.

### 레코드 (핵심만)

```
CNAME  www       dutying-web-ai.pages.dev        DNS only
CNAME  app       dutying-web-ai.pages.dev        DNS only
CNAME  dev       dutying-web-ai-dev.pages.dev    DNS only
CNAME  docs      dutying-docs.pages.dev          DNS only
CNAME  dutying.ai  dutying-landing.pages.dev     Proxied   ← Redirect Rule 이 여기서 돈다
A      api       43.202.216.112                  DNS only
A      dev.api   3.36.210.125                    DNS only
MX     dutying.ai  mx.zoho.com / mx2 / mx3
TXT    dutying.ai  "v=spf1 include:zohomail.com ~all"
TXT    dutying.ai  "zoho-verification=..."
TXT    dutying.ai  "google-site-verification=C6O_..."   ← 지우면 GSC 소유확인 풀림
```

**규칙들:**

- **`google-site-verification` TXT 절대 삭제 금지.** Search Console 도메인 속성 소유확인이 이것 하나에 걸려 있다.
- **Proxied(주황) vs DNS only(회색):** 웹 호스트는 전부 회색이다. 요청이 Cloudflare 망은 타지만 **존 레벨 기능(WAF·레이트리밋·캐시 규칙·Redirect Rule)은 안 걸린다.** apex만 주황인 이유가 Redirect Rule 때문. 나중에 `www`에 WAF를 걸고 싶으면 주황 전환 + Pages 라우팅 재확인 필요.
- **"origin IP exposed" 경고는 웹 호스트에선 오탐이다.** 노출되는 IP가 Cloudflare 자기 애니캐스트다(Pages가 곧 오리진). **`api.`는 진짜다** — EC2 IP가 그대로 보인다. 프록시를 켜면 가려지지만 TLS 종료·업로드 제한·WebSocket 동작이 바뀌므로 일부러 안 켰다.
- apex → www 리다이렉트는 **Rules → Redirect Rules** 에 있다 (301, path+query 보존).

## 4. Cloudflare Pages

### 프로젝트 4개 공통 설정

| 항목 | 값 |
| --- | --- |
| 레포 | `gom-3/dutying-web-ai` (public — private는 무료 플랜에서 CI 제한) |
| 빌드 | `pnpm build:app` / `build:landing` / `build:docs` |
| 산출물 | `apps/{app,landing,docs}/dist` |
| Root directory | `/` (레포 루트 — 모노레포라 워크스페이스 설치 필요) |
| **Preview branch** | **None** ← 중요 |
| 환경변수 | `NODE_VERSION=22`, `VITE_SERVER_URL=https://api.dutying.ai`, GA/Pixel ID |

**규칙들:**

- **Preview branch는 반드시 None.** All non-Production으로 두면 `develop`·`changeset-release/*` 푸시마다 4개 프로젝트가 전부 빌드를 돌려 무료 플랜 큐가 막히고, **프로덕션 배포가 몇 시간씩 Queued에 갇힌다.** 실제로 두 번 당했다.
- **대시보드 저장이 조용히 실패한다.** 설정 바꾸면 저장 후 새로고침해서 값이 남았는지 확인할 것 (Preview branch가 혼자 되돌아간 적 있음).
- **배포가 안 된 것처럼 보이면 코드 의심 전에 Deployments 탭에서 Queued 확인.** "환경변수 미반영"으로 오진했던 진짜 원인이 큐 백업이었다.
- **`_redirects` 파일 쓰지 말 것.** Pages는 SPA fallback이 내장이라 필요 없고, `/* → /index.html` 을 넣으면 "Infinite loop detected"로 무시된다.
- 보안 헤더는 `apps/*/public/_headers` 로 배포한다 (HSTS preload, nosniff, frame DENY, referrer, permissions — 5종). AASA에 `Content-Type: application/json`도 여기서 준다.
- dev/prod는 **같은 코드, 다른 브랜치**다. `main`↔`develop`은 항상 동기 상태를 유지한다 (릴리스 플로우: `develop` → release PR → `main`).

### 빌드 타임 사이트 URL 결정 (`apps/app/vite.config.ts`)

```
VITE_APP_PUBLIC_URL(명시) > CF_PAGES preview면 dev URL > CF_PAGES_URL > 기본값
기본값: defaultAppSiteUrl = 'https://www.dutying.ai'
```

- **Cloudflare에는 `VITE_APP_PUBLIC_URL`이 없다. 일부러다.** 기본값이 곧 프로덕션 값이고, `isProductionSite = (appSiteUrl === defaultAppSiteUrl)` 판정이 robots/sitemap/색인을 전부 결정한다. **이 기본값을 바꾸면 사이트가 통째로 noindex로 나갈 수 있다.**
- 로컬 빌드 결과가 이상하면(`local.app.dutying.net` canonical 등) 십중팔구 `.env.local`이 끼어든 것. `.env*`는 커밋 안 되므로 Cloudflare 빌드와 무관.
- Cloudflare prod 조건 재현: `CF_PAGES=1 CF_PAGES_BRANCH=main pnpm build:app`

## 5. SEO

### 자산 현황

| | robots.txt | sitemap | canonical | 구조화 데이터 |
| --- | --- | --- | --- | --- |
| `www` (앱) | Allow + sitemap 링크 | `/sitemap.xml` (빌드시 생성) | `https://www.dutying.ai/` | — |
| `app` | Allow | 동일 빌드 | **www로** (cross-host 통합) | — |
| `dev` | **Disallow: /** + meta noindex | 없음 | — | — |
| `docs` | Allow | VitePress 자동 (`lastmod` 포함) | 페이지별 | — |

**규칙들:**

- **검증은 상태 코드가 아니라 `content-type` + 본문 첫 바이트로.** Pages SPA fallback 때문에 없는 파일도 200 + HTML이 온다. `<!DOCTYPE`로 시작하면 그 파일은 없는 거다. 이걸로 "SEO 자산 정상"이라고 오진한 적 있다.
- **canonical은 리다이렉트되는 주소를 가리키면 안 된다.** apex는 www로 301이므로 canonical에 apex를 쓰면 안티패턴. 기본값·환경변수·astro `site`가 서로 다른 호스트를 가리키는 사고가 실제로 있었다 — 지금은 전부 www로 통일.
- dev가 프로덕션과 같은 앱을 서빙하므로 **dev는 반드시 noindex** (중복 콘텐츠 경쟁 방지). 브랜치가 `main`이 아니면 빌드가 알아서 noindex를 박는다.

### Search Console (Google)

- 계정: **`gom3.official@gmail.com`** 에 도메인 속성 `sc-domain:dutying.ai` + `sc-domain:dutying.net` 둘 다.
- `.ai` 소유확인 = DNS TXT (위 3절). `.net`은 등록기관 연동으로 자동 확인됨 (TXT 불필요였음).
- 제출된 사이트맵: `www.dutying.ai/sitemap.xml`, `app.dutying.ai/sitemap.xml`, `docs.dutying.ai/sitemap.xml`.
- **Google이 권하는 "Cloudflare 계정 연결로 자동 인증"은 쓰지 않는다** — Google에 DNS 계정 권한을 넘기는 것. `안내 대상: 모든 DNS 제공업체`로 바꾸면 수동 TXT 경로가 나온다.
- **주소 변경 도구(.net→.ai)는 아직 못 쓴다.** 사전검사가 구 홈페이지의 301을 요구하는데 `.net`은 이사 안내 모달 때문에 200을 내야 한다. 2단계 전략:
  1. **지금**: `.net`에 cross-domain canonical (`dutying-web` PR #284) — 힌트로 랭킹 이전 축적
  2. **`.net` 종료 전**: 전 경로 301 + 주소 변경 도구. **데드라인 2027-01-13** (만료 2027-07-12 − 301 유지 요건 180일). 넘기면 도메인을 한 번 더 갱신하거나 도구를 포기해야 한다.
- `.net` 랭킹 자산: 3개월 클릭 467 · 노출 9,110 · **평균 6.3위**, 가치의 100%가 루트 한 페이지. 미룰수록 손해.

### 네이버 서치어드바이저

- **인증 코드는 사이트마다 새로 발급된다.** 구 `.net` 코드를 옮겨 심어도 절대 통과 안 한다 (실제로 그렇게 심었다가 제거함).
- `www.dutying.ai` 등록 후 받은 코드를 `apps/app/index.html` `<head>`에 넣고 배포 → 소유확인. **배포 완료(5~6분) 전에 확인 누르면 실패한다.**

### 딥링크 (AASA)

- `apps/app/public/.well-known/apple-app-site-association` — 두 appID(`ai.dutying.app` 신규 / `com.gom3.dutying` 구)의 paths를 관리한다.
- **이 파일은 충돌·병합 시 최우선 확인 대상.** 텍스트 충돌 없이도 한쪽 블록이 사라지면 유니버설 링크가 조용히 죽는다. 경로 제거는 의도일 수 있으니(2026-08-24 nultalk/board/notice 제거처럼) blame으로 커밋 의도를 확인하고 합칠 것.

## 6. 한 방 검증

```bash
bash scripts/verify-ai-cutover.sh
```

웹 호스트 5종 · 보안 헤더 · **호스트↔앱 매핑**(www/app/dev가 앱을 서빙하는지 + canonical이 www로 모이는지) · 색인 정책 · AASA · API 라우트 10종 · CORS · **배포 번들이 실제 부르는 API**(환경변수가 아니라 번들 본문에서 읽음) · 구 `.net` 생존까지 한 번에 본다.

**뭘 바꿨든 이걸 돌려서 전부 초록인지 보고 끝내는 게 규칙이다.**

## 7. 구 `.net` 과의 관계

- `.net`은 **별도 스택**이다: 레포 `gom-3/dutying-web`(Vercel) + 구 서버·구 DB. 계정도 분리돼 있어 `.ai` 재가입 필요.
- 방침: 2027-07-12 만료 방치. 그 전에 SES 발신 도메인, 배포된 모바일 앱의 `api.dutying.net` 의존, 검색 랭킹(위 2단계)을 이전해야 한다.
- `.net` 쪽에 열려 있는 것: 이사 안내 모달 + cross-domain canonical PR #284 (머지 보류 중).
- `test.dutying.net`(2023 평가 프로토타입)은 이전 대상 아님 — 방치된 별개 앱, 만료와 함께 소멸 예정.
