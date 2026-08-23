# .ai 컷오버 현황판

> 최종 갱신 2026-08-23 · 이 문서가 웹(.ai) 전환의 단일 기준이다.
> 서버(API/DB) 쪽은 `dutying-server/docs/new-server-cutover-todo-2026-08-17.html` 참조.

## 한눈에

| 영역 | 상태 |
| --- | --- |
| 신규 레포 | ✅ [gom-3/dutying-web-ai](https://github.com/gom-3/dutying-web-ai) (public) — `main` 프로덕션 / `develop` 개발 |
| CI/CD | ✅ 검증 완료. 워크플로 수정 0개로 `develop → 릴리스 PR → main → Release` 작동 |
| CF Pages 대응 코드 | ✅ `main`·`develop` 동일 반영 완료 |
| Cloudflare 계정 | ✅ 가입·이메일 인증 완료 (`gom3.official@gmail.com`, account `53466deaa5db27ed5bbeca1377a9e721`) |
| Cloudflare Pages 프로젝트 | ✅ 4개 — app / app-dev / landing / docs |
| DNS (NS) | ⬜ 아직 Namecheap ← **다음 작업**: `dev` CNAME → `dutying-web-ai.pages.dev` 로 `dev.dutying.ai` 부활 |
| 구 `.net` 사이트 | ✅ 라이브 (`www.dutying.net` 200, Vercel, 구 `main` 빌드) |
| 이사 안내 모달 | 🔴 **머지 보류** — `.ai` 로그인이 깨져 있어 안내해도 가입 불가 |
| `.ai` 호스트 | ✅ **www / app / docs / dev 전부 200 (Cloudflare)** |

## 라이브 실측 (2026-08-21)

```
www.dutying.net   200   ← 구 서비스 진입점 (앱은 /app)
dutying.net       308 → www.dutying.net
dev.dutying.ai    404   ← 개발 환경 없음
www.dutying.ai    404
app.dutying.ai    404
api.dutying.net   정상 (EC2, 무관하게 생존)
```

---

## 다음 세션: Cloudflare Pages 생성

### 🔴 먼저 결정할 것 — 프로덕션 브랜치

**`main`에는 CF Pages 대응 코드가 아직 없다.** `_redirects`·`_headers`·`packageManager`·`CF_PAGES` 처리가 전부 `develop`에만 있어서, 프로덕션 브랜치를 `main`으로 잡으면 **빌드가 실패한다** (Node 버전 미고정 → 설치 실패, `_redirects` 없음 → SPA 라우트 전부 404).

둘 중 하나:

- **(권장) 먼저 develop → main 반영** — PR #1(`chore: release packages`) 머지 또는 develop을 main에 머지 → 그다음 프로덕션 브랜치 `main`
- 또는 Pages 프로덕션 브랜치를 일단 `develop`으로 두고, 나중에 `main`으로 전환

### 프로젝트 3개 설정값

Workers & Pages → Create → Pages → Connect to Git → `gom-3/dutying-web-ai`
(GitHub 앱을 `gom-3` 조직에 설치하는 승인 화면이 한 번 뜬다)

| 항목 | app | landing | docs |
| --- | --- | --- | --- |
| 프로덕션 브랜치 | `main` | `main` | `main` |
| **루트 디렉터리** | **`/`** (레포 루트) | **`/`** | **`/`** |
| 빌드 명령 | `pnpm build:app` | `pnpm build:landing` | `pnpm build:docs` |
| 출력 디렉터리 | `apps/app/dist` | `apps/landing/dist` | `apps/docs/.vitepress/dist` |

⚠️ **루트 디렉터리를 `apps/app`으로 잡으면 안 된다.** `packages/*` workspace 의존이 레포 루트에 있어서 pnpm 해석이 깨진다.

### 환경변수 (Pages 프로젝트별)

루트 `.env` / `.env.production`은 `.gitignore`에 있어 레포에 없다 — **로컬 파일에서 값을 옮겨야 한다.**

필수: `VITE_SERVER_URL` · `VITE_GA_TRACKING_ID` · `VITE_SENTRY_DSN` · `VITE_PIXEL_ID` · `VITE_HACKLE_SDK_KEY` · `VITE_CHANNEL_TALK_PLUGIN_KEY` · `VITE_MAZE_KEY` · `VITE_AIRBRIDGE_NAME` · `VITE_AIRBRIDGE_WEB_TOKEN` · `VITE_FIREBASE_*` 7종

🔴 **`VITE_SERVER_URL` 주의** — 현재 `.env.production`은 `https://api.dutying.net`. 코드 기본값은 `https://api.dutying.ai`인데 **그 호스트는 TLS 인증서가 없다**. 서버에 `api.dutying.ai` 인증서를 발급하기 전까지는 `api.dutying.net`을 명시적으로 넣어야 한다.

### 배포 후 즉시 검증

```bash
curl -i https://<project>.pages.dev/.well-known/apple-app-site-association   # JSON 200, 리다이렉트 없을 것
curl -o /dev/null -w '%{http_code}\n' https://<project>.pages.dev/login        # 200 (SPA fallback 동작)
curl -sI https://<project>.pages.dev/ | grep -i strict-transport               # 보안 헤더 적용 확인
```
빌드된 `index.html`의 canonical이 `app.dutying.ai`인지도 확인 (`CF_PAGES_BRANCH=main`일 때).

### 그다음: `dev.dutying.ai` 부활 (NS 이전 불필요)

Namecheap `dutying.ai` → Advanced DNS → `dev` CNAME 값만 교체:
```
현재:  e78481807e99e2ae.vercel-dns-017.com.   (Vercel, 404)
변경:  <project>.pages.dev
```
서버 CORS/OAuth allowlist에 `https://dev.dutying.ai`가 **이미 들어있어** 호스트명을 유지하면 서버는 손댈 게 없다. 반대로 `*.pages.dev`를 그대로 쓰면 CORS에 막힌다.

---

## 이후 남은 일

### P0 — `.ai` 오픈 전 필수

- [ ] `api.dutying.ai` TLS 인증서 발급 + nginx `server_name` 추가 (현재 cert는 `CN=api.dutying.net` 단독)
- [ ] API CORS 임의 Origin 반사 차단 — `Origin: https://evil-test-example.com`이 그대로 echo되고 `allow-credentials: true`
- [ ] CORS/OAuth allowlist에 `https://www.dutying.ai`, `https://dutying.ai` 추가
- [ ] AASA 운영 검증 (구 Vercel `main`에선 SPA fallback에 먹혀 Universal Links가 깨져 있었음)
- [ ] Android `assetlinks.json` 신규 작성 (레포에 없음)

### P1 — DNS/도메인

- [ ] Cloudflare zone 생성 → Namecheap 레코드 **1:1 대조** (`docs/dns-snapshot-2026-08-21.md`)
- [ ] NS 변경 전 24h 이상 TTL 인하
- [ ] NS 전환 (`.ai` 먼저, 안정화 후 `.net`)
- [ ] SSL/TLS **Full (strict)** 고정
- [ ] 🔴 **미사용 Route 53 존 2개 정리** — `Z02108531MKO1Q20LUIWD`, `Z0424728YVCKZS86ATF1`. 위임 안 된 껍데기인데 `api`/`dev.api` 값이 Namecheap과 같아 불일치가 안 보인다. 실수로 NS를 AWS로 돌리면 메일·전 사이트 사망. 삭제 전 IaC state 확인
- [ ] Zoho MX/SPF/DKIM/DMARC 이전 확인 (메일 끊김이 가장 흔한 사고)
- [ ] `docs.dutying.ai` DNS 레코드 신규 생성 (현재 레코드 자체가 없음)
- [ ] `www` vs apex 확정 — `apps/landing`의 `marketingOrigin` 기본값은 `https://dutying.ai`(www 없음)

### P1 — 구 `.net` 마무리

- [ ] 이사 안내 모달 구현 (`/Users/beomjinkim/swm/dutying-web-legacy`, 구 레포 `main`)
      - 구 main엔 공용 Modal이 없음 (`NurseEditModal`/`CreateShiftModal`만) → 단순 오버레이 신규 작성
      - 문구 필수: 새 주소 / 이전 사유 / **재로그인 필요**(localStorage는 origin-scoped) / 데이터 이관 여부 / 문의 채널
      - 노출·CTA 클릭 트래킹 → 이전율 측정
- [ ] 구 레포 README 최상단에 `동결 · 모달 외 커밋 금지 · 종료 예정일` 명시
- [ ] 구 `main`의 canonical이 `https://dutying.net` 고정 — 정리 필요

### P2 — 서드파티 재등록

Kakao / Apple(Service ID Return URL) / Google·LINE Redirect URI · Firebase Authorized domains · **Meta Pixel 도메인 인증** · GA4 크로스도메인 · Airbridge · Sentry `allowUrls` · Hackle/ChannelTalk/Maze

### P2 — 상업 운영

- [ ] 약관·개인정보처리방침을 Notion 링크 → 자사 도메인 페이지 (`runtime.ts:23`)
- [ ] 사업자 정보 / 환불·청약철회 정책 표기
- [ ] `RenewalPage`의 `dateText: '8월 30일'` 하드코딩 정리 (`apps/app/src/pages/service-status/`)
- [ ] 레포에 커밋됐던 `.env` 키 회수 여부 확인

### 하드 데드라인 — `dutying.net` 만료 2027-07-12

Auto-Renew OFF가 방침(의도됨). 그 전에 반드시:
1. **AWS SES 발신 도메인 `.ai` 이전** — DKIM CNAME 3건 재발급 + `.ai` SPF에 `include:amazonses.com` (현재 `zohomail`만)
2. 서버 발신 주소 `no-reply@dutying.net` → `.ai`
3. 배포된 앱의 `api.dutying.net` / `webview.dutying.net` 의존 제거 + 강제 업데이트 도달률 확보
4. `ml` / `dev.api` / `admin.dutying.net` 이전·종료 결정
5. D+90 이후 Vercel 계정 정리, 구 레포 archive

---

## 밟으면 아픈 것들

| | |
| --- | --- |
| **Vercel 도메인 순서** | 이동 시 ⓐ 새 프로젝트에 부착 → ⓑ 200 확인 → ⓒ 구 프로젝트에서 분리. 역순이면 `DEPLOYMENT_NOT_FOUND` 완전 장애 (2026-08-21 실사고) |
| **307을 301/308로 바꾸지 말 것** | 브라우저·CDN 영구 캐시로 되돌리기 불가 |
| **CF Proxy + `/.well-known/*`** | Proxy 켜면 AASA가 리다이렉트/변환 대상이 되면 안 됨 → bypass 규칙 필요. 초기엔 **DNS-only(회색 구름)** 권장 |
| **레포에 있다 ≠ prod에 있다** | 구 `.net`은 구 레포 `main` 기준. `develop` 파일 읽고 prod라 단정하면 틀림 (서버 문서에 오기 3건 이력) |
| **nginx는 CI 배포 대상 아님** | prod 호스트 직접 수정 + `nginx -s reload`가 유일한 경로 |
| **로컬 `.env.local`** | `VITE_APP_PUBLIC_URL=https://local.app.dutying.net:3000`이 있어 로컬 빌드 canonical이 로컬 주소로 나옴. CF에선 해당 파일이 없으니 무관 |


---

## Cloudflare Pages 배포 (2026-08-21 완료)

프로젝트 `dutying-web-ai` / 계정 `53466deaa5db27ed5bbeca1377a9e721`

| 설정 | 값 |
| --- | --- |
| Repository | `gom-3/dutying-web-ai` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `pnpm build:app` |
| Build output | `apps/app/dist` |
| Root directory | (레포 루트) |
| 환경변수 | `NODE_VERSION=22` |

### 라이브 검증 — https://dutying-web-ai.pages.dev

```
/ /login /home /make /onboarding/ward-create /zzz-nonexistent  → 전부 200 (SPA 폴백)
/.well-known/apple-app-site-association → application/json  ✅
/favicon.png → image/png (폴백에 안 먹힘)  ✅
보안 헤더 5/5 (HSTS·nosniff·DENY·Referrer·Permissions)  ✅
canonical·og:url·sitemap·robots → https://app.dutying.ai  ✅ (CF_PAGES_BRANCH 분기 정상)
```

### `_redirects` 는 쓰지 않는다 (커밋 `048c3345`)

`/* /index.html 200` 을 넣었더니 Cloudflare가 거부했다:

```
Found invalid redirect lines:
  - #1: /*  /index.html  200
    Infinite loop detected in this rule and has been ignored.
```

**Cloudflare Pages는 SPA 폴백을 기본 제공**하므로 이 규칙이 불필요하다. 파일은 효과 없이 경고만 만들어 제거했고, 제거 후에도 딥링크가 전부 200인 것을 확인했다. `_headers` 는 정상 (`Parsed 2 valid header rules`).

> ⚠️ Vercel 시절 `vercel.json` 의 SPA rewrite 감각으로 `_redirects` 를 다시 추가하지 말 것.

### 남은 일

1. Namecheap `dev` CNAME: `e78481807e99e2ae.vercel-dns-017.com.` → `dutying-web-ai.pages.dev`
   → `dev.dutying.ai` 부활. 서버 CORS/OAuth allowlist에 이미 `https://dev.dutying.ai` 가 있어 서버 수정 불필요
2. `VITE_*` 환경변수를 Pages 프로젝트에 등록 (현재 미등록이라 API 연동 안 됨 — 화면만 뜨는 상태)
3. landing / docs Pages 프로젝트
4. NS → Cloudflare 이전 후 `.ai` 프로덕션 도메인 연결


---

## Pages 프로젝트 2개 구성 (2026-08-21)

**dev 환경은 별도 프로젝트여야 한다.** 한 프로젝트에 커스텀 도메인을 붙이면 그 도메인은 **프로덕션 브랜치**를 서빙한다. `dev.dutying.ai`를 `dutying-web-ai`(프로덕션 `main`)에 붙이면 dev 환경이 프로덕션을 보게 된다. 지금은 `main == develop`이라 증상이 없지만 develop이 앞서가는 순간 문제가 된다.

| 프로젝트 | 프로덕션 브랜치 | pages.dev | 커스텀 도메인 | canonical |
| --- | --- | --- | --- | --- |
| `dutying-web-ai` | `main` | dutying-web-ai.pages.dev | (예정) `app.dutying.ai` | `https://app.dutying.ai` |
| `dutying-web-ai-dev` | `develop` | dutying-web-ai-dev.pages.dev | `dev.dutying.ai` | `https://dev.dutying.ai` |

빌드 설정은 두 프로젝트 동일: Framework `None` / Build `pnpm build:app` / Output `apps/app/dist` / Root = 레포 루트 / `NODE_VERSION=22`

`vite.config.ts`의 `CF_PAGES_BRANCH === 'main'` 분기가 브랜치별로 canonical·OG·sitemap을 다르게 만들어내는 것을 양쪽에서 실측 확인했다.

### Namecheap DNS 변경 (dutying.ai)

```
dev  CNAME  e78481807e99e2ae.vercel-dns-017.com.   (변경 전, Vercel)
dev  CNAME  dutying-web-ai-dev.pages.dev           (변경 후, CF Pages)  TTL 5min
```

NS는 아직 Namecheap이다. Cloudflare Pages는 **외부 DNS에서도 CNAME 방식으로 커스텀 도메인을 지원**하므로 NS 이전 없이 연결했다. 서버 CORS/OAuth allowlist에 `https://dev.dutying.ai`가 이미 있어 **서버 변경 불필요**.

### 남은 일

1. `VITE_*` 환경변수를 두 Pages 프로젝트에 등록 — **미등록이라 현재 API 연동 안 됨** (화면만 뜸)
2. landing / docs Pages 프로젝트
3. NS → Cloudflare 이전 후 `www`·`app.dutying.ai` 연결
4. 구 `.net` 이사 안내 모달 (구 레포 `gom-3/dutying-web` `main`, Vercel 배포 유지)


---

## 환경변수 결정 (2026-08-21)

`.env`에 30개 가까운 키가 있었지만 **대부분 코드에서 죽은 값**이었다. 실측:

| 키 | 코드에서 |
| --- | --- |
| `VITE_FIREBASE_*`, `VITE_HACKLE_SDK_KEY`, `VITE_AIRBRIDGE_*`, `VITE_CHANNEL_TALK_PLUGIN_KEY`, `VITE_MAZE_KEY` | **의존성·참조 0건** — 구 앱 잔재 |
| `VITE_SENTRY_DSN` | 안 읽음 (DSN이 `initializeApp.ts`에 하드코딩) |
| `VITE_GA_TRACKING_ID`, `VITE_PIXEL_ID` | ✅ 사용 (`import.meta.env.PROD` 조건부) |
| `VITE_SERVER_URL` | ✅ 사용 |

→ **관리 대상은 4개면 충분하다.** 나머지는 옮기지 않았다.

| 변수 | dev 프로젝트 | prod 프로젝트 |
| --- | --- | --- |
| `NODE_VERSION` | `22` | `22` |
| `VITE_SERVER_URL` | `https://dev.api.dutying.net` | `https://api.dutying.net` |
| `VITE_GA_TRACKING_ID` | **미설정** | `G-94QM502EQF` |
| `VITE_PIXEL_ID` | **미설정** | `225085720489207` |

- dev에서 GA/Pixel을 비우면 `if (gaTrackingId)` 가드에 걸려 자동으로 꺼진다 → 분기 코드 불필요, 개발 트래픽이 운영 지표에 안 섞인다.
- GA ID·Pixel ID·서버 URL은 클라이언트 번들에 박히는 **공개 식별자라 비밀값이 아니다.**
- prod가 `api.dutying.net`인 이유: **`api.dutying.ai`에 TLS 인증서가 없다.** (`dev.api.dutying.net`·`dev.api.dutying.ai`는 둘 다 유효) 인증서 발급 후 이 변수만 바꾸면 된다.

### Sentry environment 버그 수정 (커밋 `f1278764`)

Cloudflare Pages는 dev 프로젝트도 `vite build`로 빌드하므로 `import.meta.env.PROD`가 **양쪽 다 true**다. 그 결과 `environment: 'production'` 하드코딩 탓에 **dev 에러가 전부 운영 이슈로 보고되고 있었다.** 접속 도메인 기준으로 갈라도록 수정했다(기존 `isNonProductionAppDomain` 재사용, 새 환경변수 없음).

### `.env` 정리 권고

레포 루트 `.env` / `.env.production`은 gitignore 대상이지만 로컬에 죽은 키가 남아 있다. 실제 필요한 건 `VITE_SERVER_URL` 정도이므로 정리하면 혼동이 준다.


## 브랜치별 빌드 제한 (2026-08-21)

Pages는 기본이 "All non-Production branches"라 **두 프로젝트가 모든 브랜치를 빌드**했다. 푸시 한 번에 `develop`/`main`/`changeset-release/develop` × 2 프로젝트 = 6개 빌드가 큐에 쌓여, dev가 18분 전 커밋을 계속 서빙하는 일이 있었다(환경변수 미반영으로 오인하기 쉬움).

두 프로젝트 모두 **Preview branch = None**으로 변경. 각자 자기 브랜치 하나만 빌드한다.

피처 브랜치 프리뷰를 버린 이유: 프리뷰 URL(`<hash>.pages.dev`)은 **서버 CORS allowlist에 없어 API 호출이 막히므로** 깨진 화면만 나온다. 실익 없이 큐만 점유한다.

> 배포가 반영 안 된 것처럼 보이면 **먼저 Deployments 탭에서 Queued 여부를 확인할 것.** 번들 해시만 보면 오판한다.

### 최종 검증 (2026-08-21)

| | dev | prod |
| --- | --- | --- |
| 사이트 | `dev.dutying.ai` 200 | `dutying-web-ai.pages.dev` 200 |
| 번들 내 `VITE_SERVER_URL` | `dev.api.dutying.net` ✅ | `api.dutying.net` ✅ |
| GA / Pixel | 0 / 0 (의도적 미설정) | 2 / 2 ✅ |
| API CORS 프리플라이트 | `→ dev.dutying.ai` 허용 | `→ pages.dev` 허용 |

⚠️ prod CORS가 `*.pages.dev`도 통과하는 건 **서버가 임의 Origin을 반사**하기 때문(`allow-credentials: true`). 상업 오픈 전 필수 수정 — `docs/dutying-ai-migration-plan.md` B3 참조.


---

## Pages 프로젝트 4개 최종 구성 (2026-08-21)

| 프로젝트 | 앱 | 브랜치 | 빌드 명령 | 출력 | pages.dev |
| --- | --- | --- | --- | --- | --- |
| `dutying-web-ai` | app | `main` | `pnpm build:app` | `apps/app/dist` | ✅ 200 |
| `dutying-web-ai-dev` | app | `develop` | `pnpm build:app` | `apps/app/dist` | ✅ 200 |
| `dutying-landing` | landing | `main` | `pnpm build:landing` | `apps/landing/dist` | ✅ 200 |
| `dutying-docs` | docs | `main` | `pnpm build:docs` | `apps/docs/.vitepress/dist` | ✅ 200 |

공통: Framework preset `None` / Root directory = 레포 루트 / `NODE_VERSION=22` / **Preview branch = None**

### 프로젝트별 환경변수

| 프로젝트 | 변수 |
| --- | --- |
| `dutying-web-ai` | `VITE_SERVER_URL=https://api.dutying.net`, `VITE_GA_TRACKING_ID`, `VITE_PIXEL_ID` |
| `dutying-web-ai-dev` | `VITE_SERVER_URL=https://dev.api.dutying.net` (GA/Pixel 미설정) |
| `dutying-landing` | `PUBLIC_MARKETING_SITE_URL=https://www.dutying.ai`, `PUBLIC_APP_SITE_URL=https://app.dutying.ai`, `PUBLIC_DOCS_SITE_URL=https://docs.dutying.ai` |
| `dutying-docs` | (없음) |

### landing 검증

CTA 링크가 환경변수대로 렌더된다:

```
https://app.dutying.ai/login
https://app.dutying.ai/login?next=%2Fmake
https://app.dutying.ai/make
https://app.dutying.ai/signup
https://www.dutying.ai
```

AASA `application/json` ✅ (`apps/landing/public/_headers`가 dist로 그대로 전달됨)

### 다음: NS → Cloudflare 이전

⚠️ 가장 위험한 단계. `docs/dns-snapshot-2026-08-21.md`의 전체 레코드 표로 **1:1 대조 후** NS를 변경할 것. 특히:
- Zoho MX 3건 + `zoho-verification` TXT + SPF + `zmail._domainkey` DKIM → 누락 시 **메일 전면 중단**
- `_dmarc` TXT
- `api` / `dev.api` A 레코드 (EC2)
- 미사용 Route 53 존 2개는 이 시점에 정리 (T3-2b)


---

## Cloudflare 존 생성 + NS 이전 (2026-08-21, **NS 변경 대기 중**)

`dutying.ai` 존을 Cloudflare에 생성했다. Zone ID `8e927a505d594219bfce819910b67157`, Free 플랜.

### 🔴 스캔이 레코드를 하나 놓쳤다

Cloudflare 자동 스캔 결과는 **A 2건**이었으나 실제로는 **3건**이다. `dev.api`(2단계 서브도메인)가 누락됐다. 그대로 활성화했으면 `dev.api.dutying.ai`가 죽는다. 수동 추가했다.

> **교훈: 스캔 결과를 그대로 믿지 말고 반드시 스냅샷과 건수부터 대조할 것.**

### 최종 13건 (스냅샷과 1:1 일치 확인)

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | api | 43.202.216.112 | DNS only |
| A | dev.api | 3.36.210.125 | DNS only ← 수동 추가 |
| A | @ | 216.198.79.1 | DNS only |
| CNAME | app | e78481807e99e2ae.vercel-dns-017.com | DNS only |
| CNAME | dev | dutying-web-ai-dev.pages.dev | DNS only |
| CNAME | www | e78481807e99e2ae.vercel-dns-017.com | DNS only |
| MX ×3 | @ | mx/mx2/mx3.zoho.com | DNS only |
| TXT | _dmarc / @ zoho-verification / @ spf / zmail._domainkey | | DNS only |

**전부 DNS only로 둔 이유**: NS 전환 중에는 일부 리졸버가 Namecheap을, 일부가 Cloudflare를 본다. 두 존의 동작이 **완전히 같아야** 무중단이다. 프록시는 전환·검증이 끝난 뒤 켠다.

`api`/`dev.api`는 전환 후에도 DNS only 유지 — 오리진 인증서가 `CN=api.dutying.net`이라 프록시 + Full(strict)에서 깨진다.

### ⏸ 남은 조작: Namecheap NS 변경

`dutying.ai → Domain → NAMESERVERS`를 **Custom DNS**로:

```
kyrie.ns.cloudflare.com
priscilla.ns.cloudflare.com
```

이 조작은 자동화가 차단되어 **사람이 직접 해야 한다**(이메일 포함 도메인 전체에 영향).

전환 후 순서:
1. `dig NS dutying.ai` 로 Cloudflare NS 확인
2. **메일 먼저 검증** — MX/SPF/DKIM/DMARC 응답 확인, 실제 수·발신 테스트
3. Pages 커스텀 도메인 연결: `www`·`@` → `dutying-landing`, `app` → `dutying-web-ai`, `docs` → `dutying-docs`
4. `dev`는 이미 `dutying-web-ai-dev`에 연결됨 (자동 승계)
5. 미사용 Route 53 존 2개 삭제 (T3-2b)

---

## `.net` 이사 안내 모달 (2026-08-21, **배포 대기**)

구 레포 `gom-3/dutying-web` 브랜치 `feat/service-moved-modal`, 커밋 `c223d2f`.

- `src/components/ServiceMovedModal/index.tsx` 신규
- `src/App.tsx`에 마운트 (`Router` 위, `#modal-root` 포털)

문구에 명시한 것 — **계정 분리(재가입 필요)**, **기존 근무표 미이전**, **구 사이트는 당분간 유지**. 세 가지 모두 안 알리면 CS로 돌아온다.

검증 완료: 데스크톱·모바일(375px) 렌더, "오늘 하루 보지 않기" → localStorage 24.00h 저장 → 새로고침 시 미노출, `body.overflow` 복원, `tsc && vite build` 통과.

> ⚠️ **`main`에 푸시하지 않았다.** 푸시하면 Vercel이 즉시 배포하는데 `www.dutying.ai`가 아직 404다. **`.ai` 오픈 확인 후** 머지할 것.


---

## 🎉 `.ai` 오픈 — NS 이전 없이 CNAME으로 (2026-08-21)

**NS 전환을 기다릴 필요가 없었다.** Cloudflare Pages는 외부 DNS에서도 CNAME 방식 커스텀 도메인을 지원한다(`dev.dutying.ai`를 살린 것과 동일 경로). NS는 Namecheap에 둔 채로 `.ai`를 오픈했다.

### Namecheap DNS 변경 (dutying.ai)

| Host | 변경 전 | 변경 후 |
| --- | --- | --- |
| `app` | e78481807e99e2ae.vercel-dns-017.com. | **dutying-web-ai.pages.dev** |
| `www` | e78481807e99e2ae.vercel-dns-017.com. | **dutying-landing.pages.dev** |
| `docs` | (없음) | **dutying-docs.pages.dev** ← 신규 |
| `dev` | (이미 변경됨) | dutying-web-ai-dev.pages.dev |

### 배포 매핑 최종

| 호스트 | Pages 프로젝트 | 브랜치 |
| --- | --- | --- |
| `www.dutying.ai` | `dutying-landing` | main |
| `app.dutying.ai` | `dutying-web-ai` | main |
| `docs.dutying.ai` | `dutying-docs` | main |
| `dev.dutying.ai` | `dutying-web-ai-dev` | develop |

### 검증 중 배운 것 — 404를 인증서 문제로 오진하지 말 것

전환 직후 `app`/`www`가 404였는데 원인이 둘로 갈렸다:

- **`app`**: 응답 헤더가 `server: Vercel` + `x-vercel-error: DEPLOYMENT_NOT_FOUND`. **로컬 리졸버 캐시**가 옛 CNAME을 들고 있어서 Vercel로 간 것. `--resolve`로 pages.dev IP를 강제하니 **200**. Cloudflare 대시보드에서도 Active/SSL enabled였다.
- **`www`**: TLS 핸드셰이크 자체 실패(`000`) + 대시보드 상태 `Inactive (Requires DNS setup)`. 이건 진짜 인증서 미발급. **Complete DNS setup → Check DNS records**로 검증을 걸어야 발급이 시작된다.

> 진단 순서: ① 응답 헤더의 `server:`로 **누가 응답하는지** 먼저 본다 → Vercel이면 DNS 캐시, TLS 실패면 인증서. ② 대시보드 커스텀 도메인 status를 본다. 상태코드만 보면 오진한다.

### ✅ Cloudflare 존 동기화 완료 (14건)

존(pending)의 레코드를 Namecheap과 **1:1로 맞췄다. NS를 넘겨도 죽는 호스트가 없다.**

```
A      api      43.202.216.112                  DNS only
A      dev.api  3.36.210.125                    DNS only
A      @        216.198.79.1                    DNS only
CNAME  app   →  dutying-web-ai.pages.dev        DNS only
CNAME  dev   →  dutying-web-ai-dev.pages.dev    DNS only
CNAME  docs  →  dutying-docs.pages.dev          DNS only
CNAME  www   →  dutying-landing.pages.dev       DNS only
MX ×3    mx/mx2/mx3.zoho.com
TXT ×4   _dmarc / zoho-verification / spf / zmail._domainkey
```

**대시보드 팁**: 레코드 추가/편집 다이얼로그가 불안정해 저장이 자주 유실된다. **Import 버튼 + BIND 존 파일** 경로가 훨씬 안정적이다. 한 줄짜리 파일도 받는다:

```
docs.dutying.ai. 1 IN CNAME dutying-docs.pages.dev.
```

업로드 시 "Proxy imported DNS records" 체크는 **해제**해야 DNS only로 들어간다.


---

## ✅ `.ai` 오픈 완료 (2026-08-21)

```
www.dutying.ai   200  cloudflare   ← 랜딩 (Astro)
app.dutying.ai   200  cloudflare   ← 제품 앱 (canonical=app.dutying.ai, /login 200, AASA=json)
docs.dutying.ai  200  cloudflare   ← 문서 (VitePress)
dev.dutying.ai   200  cloudflare   ← 개발 (develop 브랜치)
www.dutying.net  200  Vercel       ← 구 서비스 (그대로 유지)
```

랜딩 CTA가 `https://app.dutying.ai/login` 등으로 정상 렌더되는 것까지 확인.

### 남은 일

| 항목 | 비고 |
| --- | --- |
| **이사 안내 모달 배포** | 구 레포 `feat/service-moved-modal`(`c223d2f`) → `main` 머지. **운영 배포라 자동화 차단** — 사람이 머지 |
| Cloudflare 존에 `docs` CNAME 추가 | NS 전환 전 필수 (안 하면 전환 순간 docs 죽음) |
| NS → Cloudflare 전환 | **선택.** CNAME으로 이미 오픈했으므로 급하지 않음. 전환 시 메일(Zoho MX/SPF/DKIM/DMARC) 검증 필수 |
| 미사용 Route 53 존 2개 삭제 | `Z02108531MKO1Q20LUIWD`, `Z0424728YVCKZS86ATF1` — IaC state 확인 후 |
| Vercel `.ai` 도메인 정리 | `app`/`www.dutying.ai`가 Vercel에도 남아 있음. DNS가 Cloudflare를 가리켜 무해하지만 정리 권장 |
| `api.dutying.ai` TLS | 미발급. prod가 `api.dutying.net`을 쓰는 이유 |
| API CORS 임의 Origin 반사 | 상업 오픈 전 필수 수정 |


---

## 🟡 서버 설정 — 커밋본은 정상, 로컬 미커밋만 위험 (2026-08-21)

**정정**: 처음엔 "서버가 `.ai`를 막는다"고 봤으나, 확인 결과 **커밋된 `origin/develop`은 정상**이다.
CORS·OAuth 화이트리스트 모두 `.ai`·`.net` 양쪽을 포함한다:

```
https://app.dutying.ai      https://app.dutying.net
https://dev.dutying.ai      https://dev.dutying.net
https://dev.app.dutying.ai  https://dev.app.dutying.net
```

위험한 것은 **`dutying-server` 워킹트리의 미커밋 변경(다른 세션 작업, 29파일)** 뿐이다. `.ai`가 404이던 시점에 `.net`으로 되돌린 것으로, 그때는 옳았다. **이게 그대로 커밋·배포되면** 신규 서비스가 깨진다.

`src/main/resources/application-common.yml` 현재 미커밋 diff:

| 설정 | origin/develop (커밋본) | 워킹트리 (미커밋) |
| --- | --- | --- |
| `security.cors.allowed-origins` | ✅ `.ai`+`.net` | ⚠️ `.net`만 |
| `auth.oauth.redirect.allowed-origins` | ✅ `.ai`+`.net` | ⚠️ `.net`만 |
| `auth.oauth.redirect.default-url` | `https://app.dutying.ai/` | ⚠️ `https://www.dutying.net/` |
| `app.push.web-base-url` | `https://www.dutying.ai/app` | ⚠️ `https://www.dutying.net/app` |

### 증상 (미커밋본이 그대로 배포되면)

- `app.dutying.ai` → API 호출이 **CORS 차단**
- OAuth 로그인 후 `app.dutying.ai`로 **리다이렉트 거부**
- 푸시 딥링크가 구 `.net`으로 감

### 지금 왜 안 터지나

prod가 도는 `origin/main`은 `setAllowedOriginPatterns(["*"])` + `allowCredentials(true)` — **임의 Origin을 반사**한다. 그래서 `app.dutying.ai`가 우연히 통과 중이다. 이건 **보안 취약점이자 지금 서비스가 붙어 있는 이유**다.

즉 서버 배포는 **`origin/develop`을 그대로 올리면 된다** — 화이트리스트가 이미 양쪽을 포함하고, 취약한 반사형 CORS도 이미 화이트리스트 방식으로 고쳐져 있다.

주의할 것은 하나뿐:

> ⚠️ **`dutying-server` 워킹트리의 `.net` 되돌림을 커밋하지 말 것.** 커밋하면 `app.dutying.ai`가 CORS·OAuth에서 차단된다. 서버 담당 세션이 이 미커밋 변경을 폐기하거나 `.ai`를 다시 넣어야 한다. (미커밋 파일이 29개라 이 세션에서는 손대지 않았다.)


---

## 🔴 apex `dutying.ai`는 아직 404 — NS 전환이 **필수**가 되는 유일한 이유

```
dutying.ai        404  Vercel   ← 주소창에 "dutying.ai" 치면 깨진 화면
www.dutying.ai    200  cloudflare
app.dutying.ai    200  cloudflare
docs.dutying.ai   200  cloudflare
dev.dutying.ai    200  cloudflare
```

apex A 레코드가 아직 Vercel(`216.198.79.1`)을 가리킨다.

### 왜 CNAME 방식으로 못 고치나

Cloudflare Pages에 `dutying.ai`를 커스텀 도메인으로 추가하려 하면 **"Transfer DNS management"만 제시하고 CNAME 옵션을 주지 않는다.**

> Before adding **dutying.ai** to your Pages project, you'll need to transfer your DNS to Cloudflare.

**DNS 표준상 zone apex에는 CNAME을 둘 수 없기 때문**이다. 서브도메인(`www`/`app`/`docs`/`dev`)은 CNAME으로 우회했지만 apex는 구조적으로 불가능하다.

### 선택지

| 방법 | 결과 |
| --- | --- |
| **NS → Cloudflare 전환** | ✅ 정석. Pages가 apex를 네이티브 지원. 존 14건 동기화 완료라 **지금 넘기면 바로 됨** |
| Namecheap ALIAS 레코드 | ❌ Pages가 Host를 모르므로 404. apex가 커스텀 도메인으로 등록돼야 하는데 그게 NS 전환을 요구 |
| Namecheap URL Redirect | 🟡 apex→www 리다이렉트. HTTPS 인증서 제공 여부 불확실 |

> **결론 정정**: 앞서 "NS 전환은 선택"이라고 했으나, **apex를 살리려면 NS 전환이 필요하다.** 나머지 4개 호스트는 이미 CNAME으로 동작하므로, NS 전환의 유일한 남은 목적이 apex다.

### NS 전환 시 필요한 것

```
Namecheap → dutying.ai → Domain → NAMESERVERS → Custom DNS
  kyrie.ns.cloudflare.com
  priscilla.ns.cloudflare.com
```

Cloudflare 존 14건이 Namecheap과 1:1 동기화 완료라 **전환해도 죽는 호스트가 없다.** 전환 후 Pages에서 `dutying.ai`를 landing 프로젝트 커스텀 도메인으로 추가하면 apex가 살아난다.

전환 직후 검증: MX/SPF/DKIM/DMARC 응답 + 실제 메일 수·발신.


---

## SEO 정리 (2026-08-21)

`.ai` 오픈 직후 품질 점검에서 중복 색인 문제 두 건을 잡았다.

### 1. `dev.dutying.ai`가 운영과 중복 색인되고 있었다 — 수정 완료

dev는 운영과 **같은 앱**을 서빙하는데 색인이 열려 있었다. 새 도메인 SEO를 세우는 시점에 `app.dutying.ai`와 중복 콘텐츠로 경쟁하는 상태였다.

```
변경 전  robots.txt: Allow: /      meta robots: index, follow
변경 후  robots.txt: Disallow: /   meta robots: noindex, nofollow   (+ sitemap.xml 미생성)
```

`vite.config.ts`에서 **해석된 app site URL이 운영 도메인일 때만** 색인을 연다(`isProductionSite`). dev·preview·`*.pages.dev`가 전부 자동으로 커버되고 새 환경변수가 없다. 커밋 `404b1f81`, 라이브 반영 확인:

```
dev.dutying.ai   Disallow: /  + noindex, nofollow  ✅
app.dutying.ai   Allow: /     + index, follow      ✅
```

> ⚠️ 로컬에서 이 동작을 테스트하려면 `VITE_APP_PUBLIC_URL`을 명시해야 한다. 루트 `.env.local`의 `VITE_APP_PUBLIC_URL=https://local.app.dutying.net:3000`이 우선해서 로컬 빌드는 항상 noindex로 나온다(CF에는 그 파일이 없어 무관).

### 2. 구 `.net`의 canonical이 랭킹을 붙잡고 있었다 — 모달 PR에 포함

```
변경 전  <link rel="canonical" href="https://dutying.net" />
변경 후  <link rel="canonical" href="https://www.dutying.ai/" />
```

두 가지를 동시에 고친다:
- **랭킹 이전**: `.net`은 유예 후 종료되고, 리다이렉트 대신 안내 모달을 띄우는 방침이라 **cross-domain canonical이 유일한 이전 신호**다.
- **안티패턴 제거**: 종전 값 `https://dutying.net`은 www로 308 리다이렉트된다. canonical은 최종 색인 대상 URL을 가리켜야 한다.

`og:url`/`twitter:url`도 자기 주소(`https://www.dutying.net/`)로 정정했다. 기존 파일은 `twitter:url` 자리에 `og:url`이 중복돼 있었다.

→ 구 레포 `feat/service-moved-modal` 브랜치, 커밋 `4d16290`. [PR #284](https://github.com/gom-3/dutying-web/pull/284)에 포함.


---

## 🔴🔴 `app.dutying.ai` 로그인이 깨져 있다 — 모달 머지 보류

`.ai`는 페이지가 뜨지만 **아무도 로그인할 수 없다.**

```
배포된 번들이 호출: /oauth2/authorization/admin/{provider}
prod API 응답      : 404                                    ❌
prod API에 있는 것 : /oauth2/authorization/{provider}  → 302  ✅
```

라이브 번들(`index-7f8dQt8B.js`)을 직접 받아 확인했다. `oauth2/authorization/admin/` 문자열만 있고 비-admin 경로는 없다.

### 원인

웹은 `develop` 기준으로 빌드됐고, **prod API는 여전히 구 `origin/main`을 돌린다.** `/admin/` 라우트는 develop의 `AdminOAuth2AuthorizationRequestResolver`가 등록하는데 구 서버엔 그 클래스가 없다.

전형적인 **"레포에 있다 ≠ prod에 있다"** 사례다 (`dutying-server/docs/new-server-cutover-todo-2026-08-17.html` 제1규칙).

### 웹에서 고치면 안 되는 이유

`/admin/` 접두사는 단순 경로가 아니라 **관리자 계정 플로우 표식**이다:

```java
public static final String ADMIN_AUTHORIZATION_REQUEST_BASE_URI = "/oauth2/authorization/admin";
public static final String ADMIN_OAUTH2_AUTHORIZATION_ATTRIBUTE = "adminOAuth2Authorization";
// adminResolver 로 resolve 되면 markAdminFlow() 로 표식을 단다
```

앱에서 `/admin/`을 떼면 404는 사라지지만 **잘못된 계정 종류가 생성된다.** 이 앱은 병동 관리자용이므로 admin 플로우가 맞다. **앱이 옳고 서버가 낡았다.**

### 로그인만이 아니다 — 관리자 기능 전체가 없다

라이브 번들에서 호출 경로를 전수 추출해 prod API와 대조했다 (`404` = 엔드포인트 없음):

| 엔드포인트 | prod | |
| --- | --- | --- |
| `/accounts/me` | 403 | ✅ 존재 |
| `/accounts/waiting` | 403 | ✅ 존재 |
| `/wards` | 405 | ✅ 존재 |
| `/oauth2/authorization/admin/{provider}` | **404** | ❌ 소셜 로그인 |
| `/auth/admin/password/login` | **404** | ❌ 이메일 로그인 |
| `/auth/admin/password/signup` | **404** | ❌ 이메일 가입 |
| `/auth/admin/social/signup` | **404** | ❌ 소셜 가입 |
| `/auth/admin/email-verifications` | **404** | ❌ 이메일 인증 |
| `/admin/accounts/me` | **404** | ❌ |
| `/admin/wards` | **404** | ❌ 병동 관리 |
| `/accounts/me/admin-workspace` | **404** | ❌ |

**가입·로그인 경로가 전부 막혀 있다.** 구 nurse-app 계열 엔드포인트(`/accounts/*`, `/wards`)만 살아 있고, 신규 앱이 의존하는 **admin 계열이 통째로 없다.**

CORS는 정상이다 (`app.dutying.ai` 허용 + credentials). 네트워크가 아니라 **서버 버전** 문제다.

### 조치 — ⚠️ 앞선 권고 정정

처음엔 "서버 `origin/develop`을 prod에 올리면 된다"고 썼으나 **그건 계획과 반대이고 위험하다.**

`dutying-server/docs/new-server-cutover-todo-2026-08-17.html` 전략:

> 기존 서버는 **`.net`에 남기고** 3개월 유예 후 종료, **새 서버·새 DB·새 레포가 `.ai`를 승계.** 데이터 이관 없음, 기존 유저도 새 서비스에 자유 재가입.

현 prod는 **`.net` 구 서비스가 실제로 쓰고 있는 살아있는 서버**다. 여기에 develop을 올리면:
- 구 `.net` 서비스가 갈아엎힌다 (Flyway 제거 후 수동 DDL 이력 있음 — 스키마 사고 위험)
- 계획상 `.ai`는 애초에 이 서버를 쓰면 안 된다

**올바른 해법은 `.ai` 전용 새 API를 세우는 것**이다(서버 컷오버 문서 §3). 그때 `api.dutying.ai`를 회수한다 — 서버 문서가 이미 확인해둔 것:
- 라이브 웹·스토어 앱의 API base는 전부 `api.dutying.net` → **`api.dutying.ai`는 미사용, 깨끗하게 회수 가능**
- 애플 Service ID에 `api.dutying.ai` 도메인 **등록·검증 완료**
- 단 `api.dutying.ai`는 TLS 인증서 미발급 → certbot 신규 발급 필요

### 웹 쪽에서 할 일

새 API가 서면 **Pages `dutying-web-ai` 프로젝트의 `VITE_SERVER_URL`을 새 호스트로 바꾸면 끝이다** (현재 `https://api.dutying.net`). 코드 변경 없음.

> 즉 **현재 `.ai` 웹은 서버보다 앞서 있다.** 웹은 다 됐고 `.ai` 전용 백엔드가 아직 없다. `origin/develop`은 CORS 화이트리스트·admin OAuth 라우트가 모두 정상이므로 그대로 올리면 된다.

> ⚠️ **그 전에는 [PR #284](https://github.com/gom-3/dutying-web/pull/284)를 머지하지 말 것.** 모달은 `.net` 사용자에게 "새 주소에서 재가입하라"고 안내하는데, 지금 가면 로그인·가입이 안 된다. 안내를 안 하느니만 못하다.

### 순서

1. **`.ai` 전용 새 API 구축** (서버 컷오버 문서 §3) — `api.dutying.ai` 회수 + certbot 인증서 발급
   - ⚠️ 현 prod에 develop을 올리는 것이 **아니다.** 그건 `.net` 구 서비스를 깨뜨린다
2. Pages `dutying-web-ai`의 `VITE_SERVER_URL`을 새 API 호스트로 변경 → 재배포
3. 위 표의 `404`가 전부 사라졌는지 확인
4. `app.dutying.ai`에서 **실제 가입 1회 + 로그인 1회** 성공 확인
5. **그다음** PR #284 머지


---

## ✅ 웹은 옳다 — dev 환경으로 입증 (2026-08-21)

`app.dutying.ai` 가입·로그인 불가가 **웹 버그가 아님**을 dev 환경으로 확인했다.

### dev는 완전히 동작한다

`dev.dutying.ai` → `dev.api.dutying.net`:

```
CORS 프리플라이트   access-control-allow-origin: https://dev.dutying.ai   ✅
OAuth 진입          302 → https://kauth.kakao.com/oauth/authorize?...      ✅
이메일 로그인        400 (존재·검증 실패 = 정상)                             ✅
```

**같은 코드, 같은 번들인데 dev는 되고 prod는 안 된다.** 차이는 API 서버 버전 하나다.

### admin 엔드포인트 보유 현황

| API 호스트 | admin 라우트 | 비고 |
| --- | --- | --- |
| `dev.api.dutying.net` (구 dev) | ✅ 있음 | 현재 `dev.dutying.ai`가 사용 |
| `dev.api.dutying.ai` (새 서버) | ✅ 있음 | 새 서버 레포로 오늘 가동 |
| **`api.dutying.net` (prod)** | ❌ **없음** | **유일한 문제 지점** |

### 새 `.ai` 서버는 이미 만들어지고 있다

`gom-3/dutying-server-ai` — 오늘 08:04 생성, 14:13 마지막 push. 다른 세션이 활발히 작업 중이다.

- `AdminOAuth2AuthorizationRequestResolver.java` 보유 ✅
- 13:09 커밋 **"feat: dev.api.dutying.ai 가동 — 구 dev 와 동등성 확인"**
- 이후 New Relic 관측·알림 구성 진행 중

즉 **`.ai` 전용 백엔드가 이미 dev 단계까지 와 있다.** 남은 것은 prod 승격이고, 그건 그 세션의 작업 범위다.

### 웹 쪽에서 남은 일은 한 줄뿐

새 prod API(`api.dutying.ai`)가 서면:

```
Pages dutying-web-ai → Settings → Variables
  VITE_SERVER_URL:  https://api.dutying.net  →  https://api.dutying.ai
```

코드 변경 없음. 재배포 한 번이면 `.ai`가 완전히 살아난다.

> ⚠️ `dutying-server-ai` 레포는 다른 세션이 활발히 작업 중이므로 이 세션에서 손대지 않았다.


---

## ✅ prod 승격 리허설 완료 — dev를 새 `.ai` 서버에 붙여봤다 (2026-08-21)

prod 승격 전에 **웹 + 새 백엔드 조합을 dev에서 먼저 돌려봤다.** 문제가 있으면 prod가 아니라 dev에서 터지게 하려는 목적.

### 사전 확인 — 새 서버는 이미 준비돼 있었다

```
dev.api.dutying.ai
  CORS      allow-origin: https://dev.dutying.ai + credentials   ✅
  OAuth     302 → kauth.kakao.com                                 ✅
  /readyz   200                                                   ✅
```

### 전환

Pages `dutying-web-ai-dev` → `VITE_SERVER_URL`:
```
https://dev.api.dutying.net   →   https://dev.api.dutying.ai
```

### 결과 — 전 항목 통과

```
번들 내 dev.api.dutying.ai : 2건   ✅ 완전 전환
번들 내 dev.api.dutying.net: 0건   ✅ 잔재 없음
사이트                      200
CORS 프리플라이트            allow-origin: https://dev.dutying.ai
OAuth 진입                  302 → kauth.kakao.com
이메일 로그인                400 (존재·검증 실패 = 정상)
/readyz                     200
```

> 첫 측정에서 이메일 로그인이 12s 타임아웃났으나 재시도 3회 모두 400/0.1~0.8s. 일시적 지연이었다. **새 서버 첫 요청이 느릴 수 있으니 검증 시 재시도할 것.**

### 이게 의미하는 것

**웹은 새 `.ai` 백엔드와 문제없이 붙는다.** prod 승격 시 웹 쪽에서 놀랄 일이 없다는 뜻이다.

prod에서 할 일은 dev와 완전히 동일하다:
```
Pages dutying-web-ai → VITE_SERVER_URL
  https://api.dutying.net   →   https://api.dutying.ai
```
되돌리기도 같은 한 줄이다.

### 롤백

dev를 구 서버로 되돌리려면 `VITE_SERVER_URL`을 `https://dev.api.dutying.net`으로 바꾸고 재배포하면 된다. 구 dev 서버도 admin 라우트를 갖고 있어 양쪽 다 동작한다.


---

## ⚠️ 정정 — `dutying-server` 미커밋 29파일은 "실수"가 아니라 "순서 문제"다

앞서 이 변경을 "실수로 커밋되면 안 되는 되돌림"으로 적었으나, diff를 제대로 읽으니 **계획대로의 의도적 분리 작업**이다.

```
application-common.yml       CORS/OAuth allowlist → .net 전용
nginx/conf/dutying_ssl.conf  96줄 삭제 (.ai 블록 제거)
PushUrlResolver              푸시 딥링크 → www.dutying.net/app
+ docs/prod-nginx-apply-2026-08-21.md (적용 절차)
+ DDL·백업 SQL 4건
```

서버 컷오버 전략(**구 서버 = `.net` 전용 / 새 서버 = `.ai`**)에 정확히 부합한다.

### 진짜 리스크는 배포 순서다

현재 `app.dutying.ai`는 **구 서버(`api.dutying.net`)를 보고 있다.** admin 라우트가 없어 로그인은 이미 깨졌지만 **CORS는 통과**하는 상태다.

이 변경을 **지금 배포하면** CORS마저 막혀 `.ai`가 완전히 차단된다.

### 올바른 순서

```
1. .ai 전용 새 API 가동 (api.dutying.ai)
2. Pages dutying-web-ai → VITE_SERVER_URL = https://api.dutying.ai
3. .ai 가 새 API로 정상 동작 확인
4. ★ 그다음 ★ 구 서버를 .net 전용으로 분리 (이 29파일 커밋·배포)
```

**4번을 1~3번보다 먼저 하면 `.ai`가 죽는다.** 반대로 순서만 지키면 아무 문제 없다.

> 이 순서 의존성이 `dutying-server` 쪽에 기록돼 있는지는 확인하지 못했다. 서버 세션 재개 시 공유 필요.


---

## ✅ apex 사전 준비 완료 — 이제 NS 2줄이면 끝난다 (2026-08-21)

apex를 NS 전환 없이 살리는 방법은 없다는 걸 재확인했다. 하지만 **NS 전환 후 추가 작업이 없도록 Cloudflare 존을 미리 맞춰뒀다.**

### 한 일

Cloudflare 존의 apex 레코드를 A → CNAME 으로 교체:

```
변경 전  dutying.ai  A      216.198.79.1              (Vercel)
변경 후  dutying.ai  CNAME  dutying-landing.pages.dev  (www 와 동일 타깃)
```

Cloudflare는 **CNAME flattening**을 지원하므로 zone apex에 CNAME을 둘 수 있다(표준 DNS로는 불가). Cloudflare NS가 이미 flatten해서 응답한다:

```
dig A dutying.ai @kyrie.ns.cloudflare.com   →  172.66.47.20, 172.66.44.236  (Pages IP)
```

### 왜 Pages 커스텀 도메인으로는 못 했나

Pages → `dutying-landing` → Custom domains 에서 `dutying.ai` 추가를 재시도했으나 여전히 거부된다:

> Before adding **dutying.ai** to your Pages project, you'll need to transfer your DNS to Cloudflare.

존이 `pending`(NS 미전환) 상태라 Pages가 apex를 받아주지 않는다. **DNS 레코드 직접 편집은 되지만 Pages 커스텀 도메인 등록은 안 된다.**

### 현재 상태

| | |
| --- | --- |
| 라이브 apex (Namecheap NS) | 404 (Vercel) — **변경 없음, 안전** |
| Cloudflare NS의 apex | Pages IP로 flatten 응답 ✅ |
| apex TLS | ❌ 미발급 — 존이 pending이라 |

apex로 TLS 핸드셰이크하면 실패한다. **NS를 넘겨 존이 active 되는 순간 Cloudflare가 자동 발급한다.**

### 남은 조작

```
Namecheap → dutying.ai → Domain → NAMESERVERS → Custom DNS
  kyrie.ns.cloudflare.com
  priscilla.ns.cloudflare.com
```

이것 하나로 끝난다. 전환 후 **추가 설정 불필요** — apex CNAME이 이미 Pages를 가리키고 있어 인증서만 나오면 바로 뜬다.

전환 직후 확인:
```bash
dig +short dutying.ai            # Pages IP 여야 함
curl -I https://dutying.ai/      # 200
./scripts/verify-ai-cutover.sh   # apex 항목이 ✓ 로 바뀜
```

⚠️ 메일(Zoho MX 3건 + SPF/DKIM/DMARC)도 존에 그대로 있으니 전환 후 **수·발신 1회씩 테스트**할 것.


---

## 🚀 NS 전환 실행 (2026-08-21)

Namecheap → `dutying.ai` → Domain → NAMESERVERS 를 **Custom DNS** 로 변경 완료:

```
kyrie.ns.cloudflare.com
priscilla.ns.cloudflare.com
```

저장 확인 근거: REDIRECT DOMAIN / REDIRECT EMAIL 섹션 문구가
"You can create redirects via your DNS provider... you must first change your nameservers to Namecheap default"
로 바뀌었다 — Namecheap이 더 이상 이 존의 DNS를 관리하지 않는다는 뜻이다.

### 지금 상태

```
레지스트리 NS   dns1/dns2.registrar-servers.com   ← 아직 전파 전
apex           404 (Vercel)                       ← 전파되면 해소
www/app/docs/dev  200                             ← CNAME 이라 영향 없음
```

전파는 보통 30분~2시간, 최대 24시간. **전파되는 순간**:
1. Cloudflare 존이 `pending` → `active`
2. apex 인증서 자동 발급 (apex CNAME은 이미 `dutying-landing.pages.dev` 로 사전 설정됨)
3. `dutying.ai` 200

### 전파 후 확인할 것

```bash
dig +short NS dutying.ai          # cloudflare.com 이어야 함
./scripts/verify-ai-cutover.sh    # apex 항목이 ✓ 로
```

⚠️ **메일 검증 필수** — Zoho MX 3건 + SPF + DKIM + DMARC 가 존에 그대로 있지만, 전환 직후 **수·발신 1회씩** 실제 테스트할 것.

### SSL/TLS 모드 메모

현재 **Full**. 전 레코드가 DNS only 라 Cloudflare가 오리진 연결을 하지 않으므로 지금은 무해하다.

> 향후 프록시(주황 구름)를 켤 때는 **Full (strict)** 로 올려야 한다. 단 `api`/`dev.api` 는 오리진 인증서가 `CN=api.dutying.net` 이라 프록시를 켜면 깨진다 — **계속 DNS only 유지**.


---

## ✅ `.ai` prod API 전환 완료 (2026-08-23)

`api.dutying.ai`가 승격되어 **가입·로그인이 살아났다.**

```
Pages dutying-web-ai → VITE_SERVER_URL
  https://api.dutying.net  →  https://api.dutying.ai
```

### 실측

```
소셜 로그인   302 → kauth.kakao.com/oauth/authorize          ✅
              redirect_uri=https://api.dutying.ai/login/...   ✅ (.ai 로 나감)
이메일 가입   400 (검증 실패 = 엔드포인트 정상)                ✅
이메일 로그인 400                                              ✅
CORS         allow-origin: https://app.dutying.ai
             allow-credentials: true                          ✅
```

이전에 404였던 admin 라우트 8개 전부 해소. `./scripts/verify-ai-cutover.sh` **전항목 통과**.

### ⚠️ 새 API 안정성 — 502 구간 관찰됨

전환 직후 `/readyz`가 **12회 연속 502** 후 복구(8/8 200). 응답 헤더가 `server: nginx/1.25.2`였다 — Cloudflare가 아니라 **EC2 nginx가 낸 502**이므로 nginx는 정상이고 뒤의 애플리케이션 컨테이너 재시작 구간으로 보인다.

**PR #284(이사 안내 모달) 머지는 이 안정성이 확인된 뒤로 미뤘다.** 기능 조건은 이미 충족.

---

## ✅ apex `dutying.ai` 해결 (2026-08-23)

NS를 Cloudflare로 넘긴 뒤 Pages 커스텀 도메인 등록이 계속 실패해서, **Redirect Rule로 처리**했다.

```
https://dutying.ai/*  →  301  →  https://www.dutying.ai/${1}
```

- 경로·쿼리스트링 보존 확인 (`/pricing?utm_source=test` → 그대로 전달)
- **301(영구)** 이라 apex 검색 신호가 www 로 통합된다
- `.net` 도 같은 패턴(apex → www)이라 일관적이다

> apex CNAME을 `dutying-landing.pages.dev`로 두고 Proxied 까지 켰으나 **522**가 났다. Pages 가 `dutying.ai` 를 자기 커스텀 도메인으로 모르기 때문. Pages 등록 모달이 열리지 않아 Redirect Rule 로 우회했고, 결과적으로 canonical 통합 측면에서 이 편이 낫다.

### NS 전환 후 메일 무손상 확인

```
MX     mx/mx2/mx3.zoho.com  (3건)   ✅
SPF    v=spf1 include:zohomail.com   ✅
DKIM   zmail._domainkey              ✅
DMARC  v=DMARC1; p=none;             ✅
```

---

## 🔴 SEO — 안 돼 있었다. 처리 완료 (2026-08-23)

앞서 "SEO 자산 정상"이라고 기록한 것은 **오진**이었다. 상태 코드 200만 보고 판단했는데, 본문을 열어보니 파일이 아예 없고 SPA fallback HTML 이 반환되고 있었다.

```
www.dutying.ai/robots.txt    → HTML (파일 없음)   ❌ 주 진입점인데
www.dutying.ai/sitemap.xml   → HTML (파일 없음)   ❌
docs.dutying.ai/sitemap.xml  → HTML (파일 없음)   ❌
```

> **교훈: robots/sitemap 검증은 상태 코드가 아니라 `content-type` 과 본문 첫 바이트로 판단할 것.** `<!DOCTYPE` 로 시작하면 파일이 없는 것이다.

### 고친 것 (커밋 `478fc563`, `6c977a1c`)

| 대상 | 내용 |
| --- | --- |
| 랜딩 robots·sitemap | `@astrojs/sitemap` 설치 + `public/robots.txt` |
| docs robots·sitemap | VitePress `sitemap.hostname` + `public/robots.txt` |
| 랜딩 JSON-LD | **0건 → 3건** (Organization / WebSite / SoftwareApplication) |
| astro `site` 기본값 | `dutying.ai` → `www.dutying.ai` (canonical 일치) |
| `app.dutying.ai` `<html lang>` | 누락 → `lang="ko"` |
| 랜딩 네이버 소유확인 | 없음 → 구 `.net` 값 이식 |
| 검증 스크립트 | `/admin/wards` 오탐 제거 (dev·prod 동일 404 = 정상) |

### 남은 SEO — 콘솔 작업 (계정 소유자만 가능)

1. **Google Search Console** — `dutying.ai` 속성 추가 → 사이트맵 제출
   (`www` / `app` / `docs` 각각. 도메인 속성으로 잡으면 한 번에 된다)
2. **네이버 서치어드바이저** — `www.dutying.ai` 등록 (소유확인 메타는 이미 심어둠, 확인만 누르면 됨)

> ~~`.net` → `.ai` 주소 변경 도구 신고~~ — **지금은 쓸 수 없다. 아래 참조.**

### 최종 검증 (2026-08-23, 배포 반영 후 본문 확인)

`content-type` + 본문 첫 바이트까지 확인한 결과다. 상태 코드만 본 게 아니다.

```
www.dutying.ai/robots.txt        200 text/plain          User-agent: * / Allow: /
www.dutying.ai/sitemap-index.xml 200 application/xml     → sitemap-0.xml → https://www.dutying.ai/
www.dutying.ai                   canonical https://www.dutying.ai/ · JSON-LD 3건 · naver 메타 ✅
app.dutying.ai/robots.txt        200 text/plain          Sitemap: app.dutying.ai/sitemap.xml
app.dutying.ai/sitemap.xml       200 application/xml     https://app.dutying.ai/
app.dutying.ai                   <html lang="ko"> · robots "index, follow" ✅
docs.dutying.ai/robots.txt       200 text/plain          Sitemap: docs.dutying.ai/sitemap.xml
docs.dutying.ai/sitemap.xml      200 application/xml     lastmod 포함 전체 문서 ✅
dev.dutying.ai/robots.txt        Disallow: /   +  <meta robots="noindex, nofollow">  ✅
보안 헤더(www)                    HSTS preload · nosniff · frame DENY · referrer · permissions ✅
```

`sitemap.xml` ↔ `sitemap-index.xml` 이 사이트마다 다른 것은 정상이다. Astro 는 인덱스 방식,
Vite/VitePress 는 단일 파일 방식이라 각 `robots.txt` 가 자기 사이트의 실제 파일명을 가리킨다.

추가 수정 — `app` canonical 이 `https://app.dutying.ai` (슬래시 없음) 인데 사이트맵은
`https://app.dutying.ai/` 를 싣고 있어 한 글자 어긋나 있었다. canonical 쪽에 슬래시를 붙여 맞췄다. (`9efb06c0`)

### Preview branch 설정이 되돌아가 있었다

`dutying-docs` 의 Preview branch 가 **None → All non-Production branches** 로 revert 되어 있었다.
그 탓에 `develop`·`changeset-release/*` 프리뷰 빌드가 큐를 잡아먹어, 위 SEO 커밋의 프로덕션
배포가 4시간 가까이 Queued 상태로 밀려 있었다. 재설정 후 4개 프로젝트를 전부 열어 확인했다.

| 프로젝트 | 프로덕션 브랜치 | Preview branch |
| --- | --- | --- |
| `dutying-web-ai` | `main` | None ✅ |
| `dutying-web-ai-dev` | `develop` | None ✅ |
| `dutying-landing` | `main` | None ✅ |
| `dutying-docs` | `main` | None ✅ (되돌아가 있던 것을 재설정) |

> 대시보드 저장이 조용히 실패하는 경우가 있다. **저장 후 새로고침해서 값이 남아 있는지 확인할 것.**

### `.net` → `.ai` 랭킹 이전은 PR #284 에 묶여 있다

현재 `www.dutying.net` 은 여전히 `canonical → https://dutying.net` 이다. 크로스도메인 canonical 은
[PR #284](https://github.com/gom-3/dutying-web/pull/284) 안에 있고, 이 PR 은 `api.dutying.ai` 안정성 관찰
때문에 **의도적으로 머지 보류** 상태다. 즉 코드 쪽 SEO 는 `.ai` 3개 사이트 모두 끝났지만,
**구 도메인의 검색 랭킹 이전은 이 PR 머지 + Search Console 주소 변경 도구, 두 가지가 남아 있다.**

---

## 🔴 내가 앞서 적은 "주소 변경 도구 신고"는 지금 전략에서 불가능하다

앞 절에 `.net` → `.ai` **주소 변경 도구(Change of Address)** 를 쓰라고 적어뒀는데, 확인해 보니
**현재 계획으로는 통과할 수 없다.** 그대로 뒀으면 몇 번 시도하다 실패하고 원인을 못 찾았을 항목이다.

Google 문서 기준, 이 도구는 신청 전에 **자체 사전검사**를 돌린다:

> 두 사이트의 소유권을 확인하고, **사이트의 일부 페이지에 301 이 걸려 있는지 검사한다.**
> 특히 **구 홈페이지 → 신 홈페이지 301** 이 필요하고, 이전 후 **최소 180일** 유지해야 한다.

그런데 우리 계획은 `.net` 을 **살려두는 것**이다 — 이사 안내 모달을 띄워야 하니까
`www.dutying.net` 은 301 이 아니라 **200** 을 내야 한다. 즉 사전검사에서 바로 막힌다.

### 그래서 랭킹 이전은 2단계로 간다

| 단계 | 기간 | `.net` 이 내는 것 | 랭킹 이전 수단 |
| --- | --- | --- | --- |
| 1 (현재) | 지금 ~ 종료 직전 | **200** + 이사 안내 모달 | **크로스도메인 canonical** (PR #284) |
| 2 (종료 전) | 아래 데드라인 이후 | **301 → `.ai`** (전 경로) | 301 + **주소 변경 도구** |

1단계의 canonical 은 "이 페이지의 대표 주소는 `.ai` 다" 라는 **강한 힌트**지 명령이 아니다.
구글이 대체로 따르지만 301 만큼 확실하지는 않다. 그래서 2단계가 필요하다.

### ⚠️ 데드라인 — 2027-01-13

`.net` 은 **2027-07-12 만료 방치**가 방침이다. 그런데 주소 변경 도구는 **301 을 180일 유지**해야 한다.

```
2027-07-12  .net 만료 (방치 시 이 시점에 301 도 함께 사라짐)
    − 180일
2027-01-13  ← 늦어도 이날까지 .net 을 301 로 돌리고 주소 변경 도구를 신청해야 한다
```

**이 날짜를 넘기면 선택지는 둘뿐이다.**
1. `.net` 을 **한 번 더 갱신**해서 301 기간을 확보한다 (만료 방치 방침과 충돌 → 결정 필요)
2. 주소 변경 도구를 **포기**하고 1단계 canonical 이 축적한 만큼만 가져간다

기술적으로 2단계 전환은 싸다 — `.net` 은 Vercel 이라 리다이렉트 설정 한 번이면 되고,
그 시점엔 모달도 역할이 끝나 있다. **비용은 낮고 시점만 놓치면 되돌릴 수 없는 종류의 항목이다.**

### 그 밖의 SEO 자산 실측 (2026-08-23)

빠뜨린 게 없는지 본문·매직바이트까지 확인했다.

```
OG/아이콘 8건 전부 200 + 실제 PNG/ICO/SVG (매직바이트 확인, 깨진 링크 0)
  www  og-image-preview222.png · logo-wordmark-purple.png · favicon.png
  app  img/og-image-preview222.png · favicon.png
  docs og-image.png · favicon.ico · logo.svg
사이트맵 완전성   docs 11개 문서 = sitemap 11 URL ✅ / 랜딩 1페이지 = 1 URL ✅
/move 핸드오프    noindex + 사이트맵 제외 ✅ (딥링크 중계 페이지라 색인되면 안 된다)
```

---

## 🔴 콘솔 작업을 확인하다 나온 것 3가지 (2026-08-23)

"콘솔 등록만 남았다"고 넘기려다 실제로 열어봤더니, 넘겼으면 조용히 실패했을 것들이 있었다.

### 1. `dutying.net` 은 애초에 Search Console 에 없다

브라우저에 로그인된 **Google 계정 8개를 전수 확인**했다.

```
jinsim726@gmail.com    속성 0
gom3.official@gmail.com 속성 0        ← Cloudflare 운영 계정
official@dutying.ai     속성 0        ← 제품 계정
1224508@gmail.com       속성 0
heute0320@gmail.com     속성 0
surforku@gmail.com      ku-sugang.com 1건 (무관한 프로젝트)
simsime@korea.ac.kr / simsim4874@gmail.com  세션 만료 (미확인)
```

`.net` HTML 에도 `google-site-verification` 메타가 없고, `dutying.net` DNS TXT 에도 없다
(SPF 뿐). **구 사이트는 네이버만 등록돼 있었고 구글은 등록된 적이 없다**고 보는 게 맞다.

의미: 주소 변경 도구는 301 문제 이전에 **구 속성 자체가 없어서** 못 쓴다.
`.net` 도 새로 등록·소유확인해야 하고, **구/신 속성이 같은 Google 계정**이어야 한다.

> **권장: `official@dutying.ai` 계정으로 `.net` 과 `.ai` 를 모두 등록할 것.**
> 개인 계정(`jinsim726`)에 붙이면 나중에 인수인계·권한 이전이 번거로워진다.

### 2. 심어둔 네이버 소유확인 메타는 작동하지 않는다 — 제거함

`.ai` 랜딩·앱에 구 `.net` 의 `naver-site-verification` 값을 옮겨 심어두고
"확인 버튼만 누르면 된다"고 적었는데, **틀렸다.**
네이버 인증 코드는 **사이트마다 새로 발급**된다. 다른 도메인의 코드로는 통과하지 않는다.

`app.dutying.ai` 쪽은 구 `.net` 코드베이스에서 그대로 딸려온 것이라 같은 문제였다.
둘 다 제거하고, 등록 후 받은 코드를 채울 자리만 주석으로 남겼다. (`8d7a4d28`)

### 3. canonical 이 301 되는 주소를 가리킬 뻔했다

`marketingOrigin` 기본값이 **apex(`https://dutying.ai`)** 였다. apex 는 www 로 301 되므로
"리다이렉트되는 URL 을 canonical 로 지정"하는 안티패턴이다. 게다가 `astro.config` 의 `site`
기본값은 `www` 라서, **사이트맵은 www / canonical 은 apex** 로 서로 다른 호스트를 가리켰다.

운영에서는 Pages 환경변수 `PUBLIC_MARKETING_SITE_URL` 이 www 를 넣어줘서 **가려져 있었다.**
환경변수가 빠지거나 새 환경이 생기는 순간 드러났을 문제다. 기본값을 www 로 맞췄다.

```
환경변수 없이 빌드 → canonical / og:url / JSON-LD / sitemap 전부 https://www.dutying.ai/  ✅
```

> `apps/landing/src/config/__tests__/site.test.ts` 가 이 기본값을 **정확히 검증하고 있었다.**
> 그런데 CI(`vitest.yml`)는 `pnpm coverage` 로 **`apps/app` 만** 돌려서 이 테스트는
> 한 번도 실행된 적이 없었다. 테스트가 있는데도 못 걸른 이유다. → **아래에서 CI 에 붙였다.**

---

## ✅ Google Search Console 등록 완료 (2026-08-23)

`gom3.official@gmail.com` 계정에 **도메인 속성** `sc-domain:dutying.ai` 로 등록했다.
도메인 속성이라 `www` / `app` / `docs` / `dev` 등 **모든 하위 도메인을 한 속성이 커버**한다.

### 소유확인 — Cloudflare OAuth 대신 수동 TXT 를 썼다

Google 이 "Cloudflare 계정에 접근 권한을 주면 자동 인증" 을 먼저 제안하는데,
그건 **Google 에 DNS 계정 접근 권한을 넘기는 것**이다. 최소 권한 원칙에 어긋나서
`안내 대상: 모든 DNS 제공업체` 로 바꿔 **수동 TXT** 경로를 택했다.

```
TXT  dutying.ai  google-site-verification=C6O_7j8jTJVLY7kD6Ojn5rffOFB57hl4Sr-gvJ7Th1c
```

> **이 TXT 레코드를 지우면 소유확인이 풀린다.** DNS 정리할 때 건드리지 말 것.
> 기존 SPF·Zoho 검증 TXT 는 그대로 유지됨을 확인했다 (TXT 3건 공존).

### 제출한 사이트맵 4건 — 전부 "성공"

| 사이트맵 | 유형 | 발견 페이지 |
| --- | --- | --- |
| `www.dutying.ai/sitemap-index.xml` | 인덱스 | 0 (자식을 가리킴) |
| `www.dutying.ai/sitemap-0.xml` | 사이트맵 | 1 |
| `app.dutying.ai/sitemap.xml` | 사이트맵 | 1 |
| `docs.dutying.ai/sitemap.xml` | 사이트맵 | 11 |

인덱스가 발견 0 으로 잡혀서 자식(`sitemap-0.xml`)도 직접 제출해 확실히 했다.
Cloudflare DNS 레코드는 14 → 15건.

### 아직 남은 것

- **네이버 서치어드바이저** — `www.dutying.ai` 등록 후 **새로 발급되는** 코드를
  `apps/landing/src/layouts/BaseLayout.astro` 의 주석 자리에 넣고 배포 → 소유확인.
  (구 `.net` 코드는 통하지 않는다. 위 절 참조)
- **`.net` 속성** — 2027-01-13 주소 변경 도구 데드라인 대비로 **같은 계정
  (`gom3.official@gmail.com`)** 에 등록해둘 것. 계정이 다르면 그때 도구를 못 쓴다.

---

## DNS 경고 2건 해석 (2026-08-23) — 하나는 오탐, 하나는 진짜

Cloudflare DNS 화면에 경고가 떠 있어 실제로 무엇을 가리키는지 확인했다.

### 오탐 — `www.dutying.ai` 의 ⚠

> "This record exposes the IP address used in the CNAME record on dutying.ai.
> Enable the proxy status to protect your origin server."

apex 는 Proxied, `www` 는 DNS-only 라서 뜬 경고인데, **노출되는 IP 가 Cloudflare 자기 것**이다.

```
www  → dutying-landing.pages.dev  → 172.66.47.20 / 172.66.44.236   (Cloudflare 애니캐스트)
app  → dutying-web-ai.pages.dev   → 172.66.47.133 / 172.66.44.123
docs → dutying-docs.pages.dev     → 172.66.44.253 / 172.66.47.3
```

Pages 가 곧 오리진이므로 숨길 오리진이 없다. **조치 불필요.**

### 진짜 — `api.dutying.ai` 는 EC2 IP 를 그대로 드러낸다

```
api.dutying.ai      A  43.202.216.112   DNS only   ← 실제 EC2 오리진
dev.api.dutying.ai  A  3.36.210.125     DNS only
```

프록시를 켜면 가려지지만 TLS 종료·업로드 크기 제한·WebSocket 동작이 달라진다.
**지금 건드리지 않았다.** 새 API 가 막 안정된 참이라 변수를 늘릴 때가 아니다.

### 같이 알아둘 것 — 회색 구름이면 존 규칙이 안 걸린다

`www` / `app` / `docs` / `dev` 는 전부 DNS-only(회색 구름)다. 요청은 Cloudflare 망을 타지만
**존 레벨 기능(WAF 커스텀 룰, 레이트 리밋, 캐시 규칙, 봇 관리)은 이 호스트들에 적용되지 않는다.**
Pages 자체 DDoS 보호와 우리가 배포한 `_headers` 는 그대로 작동한다.

apex 를 Proxied 로 둔 것이 바로 이 때문이다 — **Redirect Rule 은 프록시된 호스트에서만 돈다.**
나중에 `app.dutying.ai` 에 WAF 나 레이트 리밋을 걸고 싶어지면 그때 프록시로 전환해야 하고,
전환 시 Pages 라우팅·인증서를 다시 확인해야 한다.

---

## ✅ `.net` 도 Search Console 등록 완료 — 그리고 앞선 결론 하나를 뒤집는다 (2026-08-23)

`gom3.official@gmail.com` 에 `sc-domain:dutying.net` 도메인 속성을 추가했다.
**Namecheap TXT 를 넣을 필요조차 없었다** — Google 이 도메인 등록기관 연동으로 자동 확인했다.
`.net` DNS(TXT/SPF)와 사이트(200)는 손대지 않았고 그대로다.

이로써 주소 변경 도구의 전제 **"구·신 속성이 같은 계정"** 이 충족됐다.

### 🔴 정정 — "`.net` 은 GSC 에 등록된 적 없다" 는 틀렸다

앞 절에서 로그인된 계정 8개에 속성이 없는 것을 보고 그렇게 적었는데, 속성을 만들자마자
**2023-10-10 에 제출된 사이트맵**이 그대로 보였다 (최종 읽음 2026-08-18, 상태 성공).
즉 **다른 계정(세션 만료된 `simsime@korea.ac.kr` 또는 `simsim4874@gmail.com` 로 추정)이
이미 소유자**다. 로그인된 계정만 보고 "등록된 적 없다"고 단정한 것이 성급했다.

> 실무상 문제는 없다. GSC 는 다중 소유자를 허용하고, 우리가 필요한 것은
> **`gom3.official` 이 양쪽을 다 소유하는 것**인데 그건 이제 충족됐다.

### 이전 대상 규모 — 랭킹 이전은 하는 게 맞다

최근 3개월 (`sc-domain:dutying.net`, 웹 검색):

```
클릭 467 · 노출 9,110 · CTR 5.1% · 평균 게재순위 6.3   ← 1페이지권
```

상위 검색어는 브랜드보다 **일반 검색어 비중이 크다** (= 신규 유입 자산):

| 검색어 | 클릭 | 노출 |
| --- | --- | --- |
| 듀팅 (브랜드) | 77 | 97 |
| 간호사 근무표 자동 프로그램 | 29 | 422 |
| 듀티표 프로그램 | 14 | 129 |
| 근무표 자동 프로그램 | 13 | 347 |
| 간호사 근무표 | 12 | 437 |
| 근무표 | 7 | 664 |
| 듀티 | 7 | 533 |

총 82개 검색어. **평균 6.3위짜리 자산을 그냥 버리는 셈이 되므로 PR #284 머지를 미룰수록 손해다.**

### canonical 매핑은 여전히 1:1 로 맞다

랭킹 페이지 breakdown (총 4행):

```
https://dutying.net/       클릭 467 / 노출 9,106   ← 사실상 전부
https://dev.dutying.net/         1 /        32
https://app.dutying.net/         0 /        58
https://test.dutying.net/        0 /        14
```

가치의 100% 가 루트 한 페이지에 몰려 있고, 그 대응이 `https://www.dutying.ai/` 이므로
PR #284 의 단일 canonical 로 충분하다. (`dutying.net` → `www.dutying.net` 308 은 정상)

### ⚠️ 종료 체크리스트에 빠져 있던 것 — `test.dutying.net`

```
dev.dutying.net    404 (Vercel 배포 사라짐)  → 색인에서 자연 소멸, 조치 불필요
app.dutying.net    404 (동상)                → 동상
test.dutying.net   200 ← 살아 있다
```

`test.dutying.net` 은 프로덕션 복제본이 아니라 **별개 앱** 이다 — `<title>듀팅 | 근무표 평가하기</title>`,
Vercel 에서 서빙 중. **robots.txt 없음 · canonical 없음 · noindex 없음** 이라 완전히 색인 가능한 상태다.

#### 조사 결과 — 이전 대상 아니다. 방치된 2023년 프로토타입이다

"확인이 필요하다"고 적었다가 직접 확인했다. 세 가지가 전부 같은 방향을 가리킨다.

```
레포     gom-3/dutying-evaluate-web   마지막 push 2023-11-02 (약 2년 10개월 방치, private)
링크     신·구 레포 어디에서도 test.dutying.net 을 참조하지 않음 (이 문서 말고는 0건)
트래픽   최근 3개월 클릭 0 / 노출 14 — 사실상 유입 없음
```

**따라서 `.ai` 로 옮길 필요 없다.** `.net` 만료(2027-07-12)와 함께 자연 소멸시키면 된다.

다만 그때까지는 **아무도 안 쓰는데 색인은 열려 있는 브랜드 표면**으로 남는다.
"듀팅" 검색 결과에 방치된 2023년 프로토타입이 섞일 수 있으니, **Vercel 배포를 지금 내려서
색인을 정리하는 쪽을 권한다** (`dev` / `app` 서브도메인은 이미 그렇게 되어 404 → 소멸 중이다).
Vercel 접근 권한이 없어 이 세션에서는 실행하지 않았다.


---

## ✅ 랜딩 테스트를 CI 에 붙였다 (`f1fc9fcc`)

위 canonical 버그를 잡았어야 할 테스트가 **한 번도 실행된 적이 없었다.** 원인을 고쳤다.

```
vitest.yml  →  pnpm coverage      (apps/app 만)
            +  pnpm test:landing  ← 추가
```

**의존성 추가는 없다** — `vitest` 는 이미 루트 devDependency 라 `apps/landing` 에
`"test": "vitest run"` 스크립트 한 줄만 넣으면 설정 파일 없이 그대로 돈다.

검증은 실제로 되돌려서 했다. `marketingOrigin` 기본값을 apex 로 되돌리자
**2건이 실패**하고, 원복하면 4건 모두 통과한다. 즉 이 테스트는 같은 버그를 다시 막는다.

```
기본값을 apex 로 → × falls back to the production dutying domains
                  × falls back safely when env overrides are blank strings
원복            → 4 passed
```

> `apps/docs` 는 테스트 파일이 없어 이번에 붙이지 않았다. 생기면 같은 방식으로 한 줄 추가하면 된다.
