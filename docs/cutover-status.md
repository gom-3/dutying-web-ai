# .ai 컷오버 현황판

> 최종 갱신 2026-08-21 · 이 문서가 웹(.ai) 전환의 단일 기준이다.
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
| 이사 안내 모달 | 🟡 구현·검증 완료, `main` 푸시(배포)만 남음 |
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

### 미완 (NS 전환 시점에 필요)

Cloudflare 존(pending 상태)의 레코드를 Namecheap과 맞추는 작업 중 **`docs` CNAME 추가만 남았다**. `app`/`www`는 존에도 반영 완료. 존이 pending이라 지금은 무해하지만, **NS를 넘기기 전 반드시 추가**할 것 — 안 하면 `docs.dutying.ai`가 NS 전환 순간 죽는다.


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
