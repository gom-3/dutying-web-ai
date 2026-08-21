# .ai 컷오버 현황판

> 최종 갱신 2026-08-21 · 이 문서가 웹(.ai) 전환의 단일 기준이다.
> 서버(API/DB) 쪽은 `dutying-server/docs/new-server-cutover-todo-2026-08-17.html` 참조.

## 한눈에

| 영역 | 상태 |
| --- | --- |
| 신규 레포 | ✅ [gom-3/dutying-web-ai](https://github.com/gom-3/dutying-web-ai) (public) — `main` 프로덕션 / `develop` 개발 |
| CI/CD | ✅ 검증 완료. 워크플로 수정 0개로 `develop → 릴리스 PR → main → Release` 작동 |
| CF Pages 대응 코드 | ✅ 커밋 `cbdfcaa7` — **단, `develop`에만 있고 `main`엔 없음** |
| Cloudflare 계정 | ✅ 가입·이메일 인증 완료 (`gom3.official@gmail.com`, account `53466deaa5db27ed5bbeca1377a9e721`) |
| Cloudflare Pages 프로젝트 | ⬜ 미생성 ← **다음 작업** |
| DNS (NS) | ⬜ 아직 Namecheap (`dns1/2.registrar-servers.com`) |
| 구 `.net` 사이트 | ✅ 라이브 (`www.dutying.net` 200, Vercel, 구 `main` 빌드) |
| 이사 안내 모달 | ⬜ 미착수 |
| `.ai` 호스트 | 🔴 전부 404 (의도됨 — CF Pages로 재구축 예정) |

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
