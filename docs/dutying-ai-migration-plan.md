# dutying.net → dutying.ai 전환 계획 (실측 기반)

> 작성: 2026-08-21 / 근거: 레포 코드 + 실제 DNS·HTTP·TLS 측정
> 이 문서는 "앞으로 할 일"이 아니라 **"지금 실제로 어떤 상태인지"** 부터 정리한다.
> 계획 수립 시 전제로 삼았던 몇 가지가 실제와 달랐다.

## 0. 요약: 전제 3가지가 실제와 다르다

| 전제 | 실제 |
| --- | --- |
| 운영 브랜치는 `master` | `master`는 없음. **`main`** 이며 2025-11-22 이후 정지, develop보다 **675 커밋 뒤** |
| `.ai` → `.net` 리다이렉트 | **방향이 반대.** `.net` → `.ai` 로 이미 리다이렉트 중 |
| 리다이렉트가 Namecheap에 있음 | **Vercel에 있음** (`server: Vercel`, 307/308). Namecheap은 NS/DNS만 담당 |

즉 `.ai` 신규 운영은 "앞으로 할 일"이 아니라 **이미 절반 진행된 상태**이고,
지금은 "구 코드가 새 도메인에서 돌고 있는" 어중간한 지점에 멈춰 있다.

---

## 1. 실측된 현재 구조

### 1.1 브랜치

| 브랜치 | 상태 |
| --- | --- |
| `origin/main` | HEAD `f17a470b` (2025-11-22). 구 단일앱 Vite 구조 (`src/`, `public/`, 루트 `vercel.json`) |
| `origin/develop` | HEAD `bd1d643b`. pnpm 모노레포 (`apps/app`, `apps/landing`, `apps/docs` + `packages/*`) |
| 차이 | `main` 기준 develop이 **675 커밋 앞**, main이 앞선 커밋은 **0개** |

두 브랜치는 디렉터리 레이아웃 자체가 달라 일반적인 머지가 사실상 불가능하다.
→ "새 브랜치를 판다"는 판단은 옳다. 다만 **새 레포는 비권장** (Issue/PR/CI/Vercel 연결·changesets 전부 재구성 비용).

### 1.2 도메인 · DNS (NS = `dns1/2.registrar-servers.com` = Namecheap)

**dutying.ai**

| 호스트 | 상태 |
| --- | --- |
| `dutying.ai` | 308 → `https://www.dutying.ai/` (Vercel) |
| `www.dutying.ai` | **200 — 구 `main` 빌드 서빙 중** |
| `app.dutying.ai` | **200 — `www`와 동일 배포** (etag 동일 `6645bbf0…`) |
| `dev.dutying.ai` | 200 — develop 모노레포 `apps/app` 빌드 |
| `api.dutying.ai` | DNS는 `43.202.216.112`로 뜨지만 **TLS 인증서 없음** (`CN=api.dutying.net`) → HTTPS 실패 |
| `docs.dutying.ai` | **DNS 레코드 자체 없음** |

**dutying.net**

| 호스트 | 상태 |
| --- | --- |
| `dutying.net` / `www.dutying.net` | 307 → `https://www.dutying.ai/` (Vercel) |
| `app.dutying.net` | 307 → `https://app.dutying.ai/` |
| `dev.dutying.net` | 307 → `https://dev.dutying.ai/` |
| `api.dutying.net` | 200 (nginx, EC2 `43.202.216.112`) — **실운영 API** |
| `dev.api.dutying.net` | EC2 `3.36.210.125` |
| `ml.dutying.net` | EC2 `13.124.57.173` (`useCreateShift`에서 호출) |
| `webview.dutying.net` | **200 살아있음** — `듀팅 | 웹뷰`, 모바일 약관 웹뷰 |
| `admin.dutying.net` | **200 살아있음** — 별도 Vercel 프로젝트 (Vite React 어드민) |
| `docs.dutying.net` | 404 (Vercel 프로젝트는 연결됨) |

**이메일**

| 도메인 | MX / SPF |
| --- | --- |
| `dutying.net` | Namecheap 이메일 포워딩 (`eforward*.registrar-servers.com`) |
| `dutying.ai` | **Zoho Mail** (`mx.zoho.com`), `zoho-verification` TXT |

서버 발신 주소는 아직 `no-reply@dutying.net` (`application-common.yml:164`).

### 1.3 코드는 이미 `.ai` 기준

- `apps/app/src/shared/config/runtime.ts:19` → `DEFAULT_SERVER_URL = 'https://api.dutying.ai'`
- `apps/app/vite.config.ts:50` → `defaultAppSiteUrl = 'https://app.dutying.ai'`
- `apps/landing/src/config/site.ts:29-31` → `dutying.ai` / `app.dutying.ai` / `docs.dutying.ai`
- `dutying-server` `application-prod.yml:35` → OAuth 기본 리다이렉트 `https://app.dutying.ai/`
- `dutying-server` `PushUrlResolver` → 푸시 웹 base `https://www.dutying.ai/app`

반면 루트 `.env` / `.env.production` 은 아직 `VITE_SERVER_URL="https://api.dutying.net"`.

---

## 2. 🔴 지금 프로덕션에 살아있는 결함

| # | 결함 | 근거 |
| --- | --- | --- |
| B1 | **`https://api.dutying.ai` TLS 인증서 없음.** develop 기본값이 이 주소라 env 미설정 시 신규 운영 전면 장애 | `curl` → `subjectAltName does not match`, cert `CN=api.dutying.net` |
| B2 | **iOS Universal Links 깨짐.** `www.dutying.ai/.well-known/apple-app-site-association` 이 JSON이 아니라 HTML 반환. `main` 브랜치에 AASA 파일이 **아예 없음** (문서엔 hotfix로 넣었다고 되어 있으나 실제 부재) | `git ls-tree origin/main` 결과 없음 + curl `content-type: text/html` |
| B3 | **API가 임의 Origin을 반사하며 `allow-credentials: true`.** `Origin: https://evil-test-example.com` → 그대로 echo. 상업 운영 전 필수 수정 | `curl -X OPTIONS` |
| B4 | prod canonical이 `https://dutying.net` (307로 튀는 주소) | `www.dutying.ai` HTML |
| B5 | prod `robots.txt` sitemap이 `https://www.dutying.net/sitemap.xml` (역시 리다이렉트) | curl |
| B6 | `.net → .ai` 가 **307(임시)**. SEO 랭킹 이전은 **301/308(영구)** 이어야 함 | curl |
| B7 | `dev.dutying.ai` 가 인증 없이 200 + `robots: index, follow` → 개발 사이트 색인 위험 | curl |
| B8 | `PRODUCTION_APP_HOSTS`에 `www.dutying.ai` 누락. www에서 앱을 서빙하면 프로덕션 판정 실패 → 온보딩 프리뷰가 운영에서 열림 | `feature-flags.ts:4` |
| B9 | 서버 푸시 base가 `https://www.dutying.ai/app` 인데 현재 www는 구 main SPA라 `/app/*` 라우트가 없음 | `PushUrlResolver.java:19` |
| B10 | Android App Links용 `assetlinks.json` 이 레포 어디에도 없음 (iOS AASA만 존재) | `find` 결과 |

---

## 3. 🟡 계획에서 빠진 고려사항

### C1. 계획의 핵심 모순 — "main에 모달"은 지금 구조에서 성립하지 않는다

`.net`은 이미 **Vercel에서 `.ai`로 리다이렉트**되므로, `.net` 방문자는 main 코드에 도달하지 못한다.
그리고 그 main 코드는 지금 **`.ai`에서** 서빙되고 있다. 즉 "main에 모달을 넣으면 `.net` 사용자에게 뜬다"가 아니라
**"`.ai` 사용자에게 뜬다"**. 셋 중 하나를 골라야 한다.

- **(A) 레거시 분리** — 구 main 배포를 `legacy.dutying.net` 같은 별도 호스트로 옮기고, `.net` 리다이렉트 해제.
  `.net` 루트는 안내 전용. → 가장 깔끔하지만 Vercel 프로젝트 재배치 필요.
- **(B) 리다이렉트 유지 + `.ai` 구버전에 모달** — 지금 `www/app.dutying.ai`가 구 main이므로,
  여기에 모달을 넣고 신규 `.ai` 오픈 시 도메인만 새 프로젝트로 갈아끼움. → 작업량 최소, 하지만 "이사 안내"가 아니라 "리뉴얼 안내"가 됨.
- **(C) `.net` 되살리기** — `.net` 리다이렉트 걷고 `.net`에 구 main + 모달 배포, `.ai`엔 신규.
  → 사용자가 원래 그린 그림. 단 `.net` Vercel 도메인 재연결 필요.

**어느 쪽이든 "Namecheap에서 리다이렉트 제거"는 할 일이 아니다. Vercel 도메인 설정에서 해야 한다.**

### C2. `.net`을 끄면 배포된 모바일 앱이 깨진다

스토어에 나간 바이너리는 되돌릴 수 없다.

- `dutying-mobile-v2/src/shared/api/client.ts:52` → 쿠키 도메인 `api.dutying.net`
- `dutying-mobile-v2/.../term-page` → `https://webview.dutying.net/terms`
- `dutying-mobile-v2/.../EnterWardPending` → `https://www.dutying.net` 링크
- `dutying-flutter/lib/core/config/env.dart:8` → `https://api.dutying.net`

→ **`api.dutying.net` / `webview.dutying.net` 은 최소 6~12개월 유지**하고, 강제 업데이트 게이트를 먼저 깔아야 한다.

### C3. `.net`엔 다른 살아있는 서비스가 붙어 있다

`webview.dutying.net`(200), `admin.dutying.net`(200), `ml.dutying.net`, `dev.api.dutying.net`.
"`.net` 정리"를 서브도메인 단위로 쪼개서 판단해야 한다.

### C4. Cloudflare 도입 — Vercel과 겹칠 때 주의점

- NS를 Namecheap → Cloudflare로 옮기면 **Vercel 도메인 검증·인증서 자동 갱신 흐름이 리셋**된다. 전환 전 TTL을 낮춰둘 것.
- Proxy(주황 구름) 켜면 Vercel 앞에 CDN이 하나 더 붙는다 → 캐시 중복, 헤더 덮어쓰기, `x-vercel-cache` 무력화.
- 특히 **AASA(`/.well-known/apple-app-site-association`)는 CF에서 리다이렉트/HTML 변환/Rocket Loader 대상이 되면 안 된다.** Page Rule로 bypass 필요.
- SSL 모드는 반드시 **Full (strict)**. Flexible이면 무한 리다이렉트.
- 상업 목적이면 CF 쪽 WAF/Bot Fight Mode가 OAuth 콜백·API를 막지 않는지 확인.
- 대안: **DNS-only(회색 구름)** 로 Cloudflare는 DNS만 쓰고 CDN/WAF는 Vercel에 맡기는 구성이 초기엔 안전하다.

### C5. 세션은 도메인을 넘어가지 않는다

`apps/app/src/features/auth/model/store.ts:54-66` 이 zustand persist + **localStorage**.
localStorage는 origin-scoped → `.net` 사용자는 `.ai`에서 **전원 재로그인**.
모달 문구에 이 내용이 들어가야 CS가 줄어든다. (`docs/landing-app-split.md` §4에도 동일 지적 있음)

### C6. SEO 자산 이전

- 307 → **301/308** 로 변경 (B6)
- Google Search Console **주소 변경 도구**로 `.net` → `.ai` 신고
- 네이버 서치어드바이저 재등록 (`naver-site-verification` 메타가 두 브랜치 모두에 있음)
- canonical / OG / sitemap을 `.ai` 기준으로 통일 (B4, B5)
- `www` vs apex 확정: 현재 apex→www(308)인데 `apps/landing`의 `marketingOrigin` 기본값은 `https://dutying.ai` (www 없음) → **불일치**

### C7. 서드파티 콘솔 등록 (도메인 바뀌면 전부 재등록)

| 대상 | 할 일 |
| --- | --- |
| Kakao 로그인 | Redirect URI에 `.ai` 추가, 사이트 도메인 등록 |
| Apple 로그인 | Service ID Return URL, 도메인 검증 |
| Google / LINE | `dutying-server-google-line-login` 브랜치 존재 → 콘솔 등록 필요 |
| Firebase | Authorized domains에 `app.dutying.ai`, `www.dutying.ai` 추가 (authDomain은 `dutying-6902a.firebaseapp.com`) |
| GA4 `G-94QM502EQF` | 크로스도메인 측정, 데이터 스트림 URL |
| Meta Pixel `225085720489207` | **도메인 인증** 필요 |
| Airbridge | 웹 토큰 도메인, 웹→앱 어트리뷰션 |
| Sentry | `allowUrls` / 릴리스 환경 분리 |
| Hackle, ChannelTalk, Maze | 도메인 허용목록 |

### C8. 상업 운영 전제라면 추가로

- **약관/개인정보처리방침이 Notion 링크** (`runtime.ts:23-31`, `www.notion.so/...`). 상업 서비스로는 부적절 → 자체 도메인 페이지 필요.
- 사업자 정보 표기(전자상거래법), 환불 정책
- PG 연동 시 결제 도메인 등록
- Vercel Pro 이상 + 팀 권한 + Preview 배포 보호
- 상태 페이지 / 인시던트 절차 (`apps/app/src/pages/service-status` 에 `MaintenancePage`, `RenewalPage` 이미 있음 — `RenewalPage` 오픈 예정일이 **8월 30일**로 하드코딩)
- `.net` 도메인은 deprecated여도 **갱신 유지** (앱 하위호환 + 이메일)

### C9. `www.dutying.ai`가 랜딩인가 앱인가

`docs/landing-app-split.md` 설계는 `dutying.ai`=Astro 랜딩 / `app.dutying.ai`=제품앱 / `docs.dutying.ai`=문서.
현재는 www와 app이 **같은 배포**. Vercel 프로젝트를 3개로 분리해야 하고, `docs.dutying.ai`는 DNS부터 없다.

---

## 4. TODO List

### Phase 0 — 사실 확인 (코드로는 확인 불가, 콘솔 접근 필요)

- [ ] **T0-1** Vercel 프로젝트 목록·각 프로젝트의 Production Branch / Root Directory / 연결 도메인 스냅샷
- [ ] **T0-2** `www.dutying.ai` + `app.dutying.ai` 가 정말 같은 프로젝트인지, 그 프로젝트의 배포 브랜치가 `main`인지 확인
- [ ] **T0-3** `.net → .ai` 307 리다이렉트가 설정된 위치(Vercel 도메인 설정 vs 프로젝트 redirects) 확인
- [x] **T0-4** ~~Namecheap DNS 레코드 전체 export~~ → `docs/dns-snapshot-2026-08-21.md` (2026-08-21 완료)
- [ ] **T0-5** `admin.dutying.net`, `webview.dutying.net`, `docs.dutying.net` 각 Vercel 프로젝트/소스 레포 파악
- [ ] **T0-6** 배포된 prod 서버가 `dutying-server`의 어느 커밋인지 (CORS 반사 이슈가 구버전 때문인지 확인)
- [ ] **T0-7** 스토어 배포된 앱 버전별 사용 도메인 정리 (`.net` 유지 기간 산정 근거)

### Phase 1 — 블로커 해소 (`.ai` 오픈 전 필수)

- [ ] **T1-1** 🔴 `api.dutying.ai` TLS 인증서 발급 + nginx server_name 추가 → `curl https://api.dutying.ai/` 200 확인 *(B1)*
- [ ] **T1-2** 🔴 API CORS를 allowlist로 고정, 임의 Origin 반사 차단. `allowedOriginPatterns("*")` 적용 범위를 OAuth 콜백 경로로만 한정 *(B3)*
- [ ] **T1-3** 🔴 CORS/OAuth allowlist에 `https://www.dutying.ai`, `https://dutying.ai` 추가 (현재 `app.*`만 있음)
- [ ] **T1-4** 🔴 AASA를 실제 운영 배포에 포함 + `Content-Type: application/json` 헤더. `curl -i` 로 JSON 200·무리다이렉트 검증 *(B2)*
- [ ] **T1-5** Android `assetlinks.json` 추가 (`/.well-known/assetlinks.json`) *(B10)*
- [ ] **T1-6** 루트 `.env.production`의 `VITE_SERVER_URL` 을 `.ai`로 옮길지 결정 → Vercel 프로젝트 env로 이관 (레포 커밋된 `.env*`에 키가 들어있는 것도 정리 대상)
- [ ] **T1-7** `PRODUCTION_APP_HOSTS`에 `www.dutying.ai` 추가, `isWardChatEnabled`의 prod 판정이 의도대로인지 확인 *(B8)*
- [ ] **T1-8** `dev.dutying.ai` 에 `robots: noindex` + Vercel Deployment Protection *(B7)*

### Phase 2 — 브랜치 / 배포 구조 확정

- [ ] **T2-1** 현재 `main`을 `legacy/main-dutying-net` 브랜치 + `legacy-2026-08` 태그로 보존
- [ ] **T2-2** 신규 운영 브랜치 확정. 권장: **기존 레포 유지 + `main`을 develop 기준으로 재설정**
      (`git branch -f main develop` → force push). 새 레포는 CI·이슈·Vercel·changesets 재구성 비용이 커서 비권장
- [ ] **T2-3** 브랜치 보호 규칙 (force push 금지, PR 필수, `vitest`/`cypress`/`type-check` 필수 체크)
- [ ] **T2-4** Vercel 프로젝트 3분할: `dutying-landing`(`apps/landing`) / `dutying-app`(`apps/app`) / `dutying-docs`(`apps/docs`)
- [ ] **T2-5** 각 프로젝트 Production Branch를 신규 운영 브랜치로 지정, Root Directory 지정
- [ ] **T2-6** `docs.dutying.ai` DNS 레코드 신규 생성 + 프로젝트 연결 *(현재 레코드 없음)*
- [ ] **T2-7** `www` vs apex 확정 후 `apps/landing` `marketingOrigin` 기본값 / canonical / sitemap 일치시키기 *(C6)*
- [ ] **T2-8** `apps/app`의 `/` 루트가 아직 `LandingPage`를 서빙 → `app.` 도메인 전용이면 `/login` 또는 `/home`으로 정리 (`Router.tsx:53,74`)

### Phase 3 — Cloudflare 전환

- [ ] **T3-1** 전환 전 모든 DNS TTL 을 300s로 낮춤 (최소 24h 선행)
- [ ] **T3-2** Cloudflare에 zone 생성 → Namecheap DNS 레코드 그대로 임포트 후 **1:1 대조 검증**
- [ ] **T3-2b** 🔴 **미사용 Route 53 호스팅 영역 2개 정리** (`Z02108531MKO1Q20LUIWD`, `Z0424728YVCKZS86ATF1`).
      위임 안 된 껍데기인데 `api`/`dev.api` 값이 Namecheap과 같아 불일치가 안 보인다. 실수로 NS를 AWS로 돌리면 메일·전 사이트가 죽는다.
      삭제 전 IaC state 확인 필수. 상세: `docs/dns-snapshot-2026-08-21.md`
- [ ] **T3-3** Namecheap에서 NS 변경 (`.ai` 먼저, 안정화 후 `.net`)
- [ ] **T3-4** SSL/TLS 모드 **Full (strict)** 고정
- [ ] **T3-5** 초기엔 **DNS-only(회색 구름)** 로 운영 → Vercel 인증서·캐시 정상 확인 후 단계적으로 Proxy 전환
- [ ] **T3-6** Proxy 켤 경우: `/.well-known/*` bypass 규칙(캐시·리다이렉트·Rocket Loader 제외) *(C4)*
- [ ] **T3-7** WAF / Bot Fight Mode 가 `/oauth2/*`·API·웹뷰를 막지 않는지 검증
- [ ] **T3-8** Zoho MX/SPF/DKIM/DMARC 레코드 이전 확인 (메일 끊김이 가장 흔한 사고)
- [ ] **T3-9** 롤백 절차 문서화 (NS 원복 + TTL 고려한 예상 복구 시간)

### Phase 4 — `.net` deprecation 안내 (모달)

- [ ] **T4-1** 🔵 **C1의 A/B/C 중 시나리오 확정** ← 이 결정 전에는 아래가 전부 재작업 리스크
- [ ] **T4-2** 결정에 맞춰 `.net` Vercel 도메인 리다이렉트 해제/변경.
      **Namecheap에 리다이렉트 설정이 없음을 2026-08-21 확인** (Domain 탭 REDIRECT DOMAIN 비어 있음) → 전적으로 Vercel 작업.
      ⚠️ 해제만 하면 `.net`은 Vercel에 붙은 프로젝트가 없어 404가 된다. **해제와 프로젝트 할당을 동시에** 해야 함
- [ ] **T4-3** 구 코드베이스에 안내 모달 구현. main엔 공용 Modal이 없으므로(`NurseEditModal`/`CreateShiftModal`만 존재) 단순 오버레이 신규 작성
- [ ] **T4-4** 모달 문구에 반드시 포함: 새 주소 / 이전 사유 / **재로그인 필요** *(C5)* / 데이터 이관 여부 / 문의 채널
- [ ] **T4-5** "오늘 하루 보지 않기" 는 localStorage, 강제 노출 구간은 별도 플래그로 분리
- [ ] **T4-6** 모달 노출·CTA 클릭 이벤트 트래킹 (GA4/Airbridge) → 이전율 측정
- [ ] **T4-7** 모달 표시 기간 및 최종 종료(sunset) 날짜 확정 + 공지사항/이메일/푸시 병행
- [ ] **T4-8** 앱 내 강제 업데이트 게이트 배포 (구 앱이 `.net`에 묶여 있으므로 선행 필요) *(C2)*

### Phase 5 — 서드파티 · SEO

- [ ] **T5-1** C7 표의 콘솔 등록 전부 처리
- [ ] **T5-2** `.net → .ai` 리다이렉트를 **301/308** 로 변경 *(B6)*
- [ ] **T5-3** canonical / OG / twitter / sitemap 을 `.ai` 기준 통일 *(B4)*
- [ ] **T5-4** prod `robots.txt` sitemap URL 수정 *(B5)*
- [ ] **T5-5** Search Console 주소 변경 도구 + 네이버 서치어드바이저 재등록
- [ ] **T5-6** 서버 발신 메일 주소 `no-reply@dutying.net` → `.ai` (Zoho) 전환 + SPF/DKIM/DMARC
- [ ] **T5-7** 푸시 web base `https://www.dutying.ai/app` 가 신규 라우팅과 맞는지 검증 *(B9)*

### Phase 6 — 상업 운영 준비

- [ ] **T6-1** 약관·개인정보처리방침을 Notion → 자사 도메인 페이지로 이전 *(C8)*
- [ ] **T6-2** 사업자 정보 / 환불·청약철회 정책 표기
- [ ] **T6-3** Vercel Pro 이상 + 팀 권한 정리 + Preview 보호
- [ ] **T6-4** 상태 페이지 / 인시던트 대응 절차. `RenewalPage`의 `dateText: '8월 30일'` 하드코딩 정리
- [x] **T6-5** ~~`.net` 자동갱신 확인~~ → **방침 확정: `.net`은 갱신하지 않고 2027-07-12 만료로 종료.** Auto-Renew OFF 유지가 정답. 대신 그 날짜가 **하드 데드라인**이 되므로 SES 발신 도메인 이전·앱 의존 제거를 역산해서 배치할 것 (`docs/dns-snapshot-2026-08-21.md` 참조)
- [ ] **T6-6** 레포에 커밋된 `.env`, `.env.production` 의 키 회수 + Vercel env로 이관, `.gitignore` 처리

### Phase 7 — 컷오버 & 검증

- [ ] **T7-1** 컷오버 리허설을 preview 도메인에서 1회 완주
- [ ] **T7-2** 컷오버 당일 체크리스트 실행 (`docs/prod-pre-deploy-checklist.md` 갱신본 사용)
- [ ] **T7-3** 검증 스크립트 상시화:
      AASA JSON 200 / `api.dutying.ai` TLS / CORS allowlist / OAuth 3사 로그인 / 딥링크(iOS·Android) /
      푸시 클릭 → 웹 라우팅 / 결제 / 재로그인 플로우 / `.net` 리다이렉트 상태코드
- [ ] **T7-4** GA4·Sentry 지표 대조 (트래픽·에러율이 `.net` 시절 대비 정상인지)
- [ ] **T7-5** 롤백 트리거 조건과 담당자 명시

---

## 5. 지금 결정해야 하는 것 (나머지가 여기 달려 있음)

1. **C1 시나리오 A/B/C** — 모달을 어디에 띄울 것인가. Phase 4 전체가 여기 종속.
2. **`www.dutying.ai` 의 정체** — Astro 랜딩인가, 제품 앱인가. Phase 2 프로젝트 분할이 여기 종속.
3. **`api` 도메인 정책** — `api.dutying.ai`로 이전할 것인가, `api.dutying.net`을 계속 정본으로 둘 것인가.
   develop 기본값은 이미 `.ai`인데 인증서가 없다. 이전한다면 T1-1이 최우선.
4. **`.net` sunset 날짜** — 스토어 앱 강제 업데이트 도달률과 연동해서 역산해야 한다.
