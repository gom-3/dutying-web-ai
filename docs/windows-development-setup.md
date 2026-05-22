# Windows 개발 환경 설정 (dutying-web)

`dutying-web`은 **pnpm workspace** 모노레포입니다. 메인 웹 앱(`apps/app`), 랜딩(`apps/landing`), 문서 사이트(`apps/docs`)를 한 저장소에서 관리합니다.

이 문서는 **Windows 10/11** 기준으로 로컬 개발 환경을 맞추는 방법을 정리합니다.

## 지원 범위

**일반적인 Windows 10/11 노트북·데스크톱(64비트)** 에서 위 절차대로 개발할 수 있습니다. macOS/Linux와 동일한 저장소·명령어·`.env`·hosts 규칙을 씁니다.

| 환경 | 가능 여부 |
|------|-----------|
| Windows 10 / 11 (Intel·AMD) | ✅ 권장 |
| Windows 11 on ARM (Snapdragon 등) | ✅ Node 22·pnpm 설치 가능 시 동일 절차 |
| Windows 7 / 8 | ❌ Node 22 미지원 — 사용 불가 |
| 회사 PC (관리자 권한 제한) | ⚠️ `hosts` 편집·방화벽·프록시에서 IT 정책 확인 필요 |
| 회사망·VPN | ⚠️ `pnpm install`(Puppeteer 다운로드) 실패 시 [4. 의존성 설치](#4-의존성-설치) 참고 |

PC마다 **한 번만** 하면 되는 것: Node/pnpm 설치, `hosts` 등록.  
새 PC나 재클론할 때마다: `pnpm install`, 루트 `.env` 복사.

## 빠른 시작 (메인 앱만)

**메인 웹 앱**을 로컬에서 띄우는 데 필요한 것은 아래와 같습니다.  
“클론 + `.env` + hosts”가 핵심이지만, 그 전에 **Node/pnpm(최초 1회)** 과 **`pnpm install`(클론할 때마다)** 도 필요합니다.

| 순서 | 언제 | 할 일 |
|------|------|--------|
| 1 | PC당 1회 | Node **22.x**, pnpm **10.12.4** 설치 → [1. 사전 준비](#1-사전-준비) |
| 2 | 클론할 때마다 | `git clone` → 저장소 **루트**에서 `pnpm install` |
| 3 | PC당 1회 | `hosts`에 `127.0.0.1 local.app.dutying.net` 추가 → [3. 로컬 hosts](#3-로컬-hosts-설정-필수) |
| 4 | 클론할 때마다 | 저장소 **루트**에 팀에서 받은 `.env` 배치 (git에 없음) → [5. 환경 변수](#5-환경-변수-env) |
| 5 | 개발할 때 | `pnpm dev` → **https://local.app.dutying.net:3000** |

```powershell
git clone https://github.com/gom-3/dutying-web.git
cd dutying-web
pnpm install

# hosts 편집 (관리자) — C:\Windows\System32\drivers\etc\hosts
# 127.0.0.1 local.app.dutying.net

# 루트에 .env 복사 (팀 공유 파일)

pnpm dev
```

### `.env` / hosts만 알면 될까?

| 항목 | 필수? | 설명 |
|------|--------|------|
| Node 22 + pnpm | **1회** | 없으면 `pnpm` 명령 자체가 안 됨 |
| `pnpm install` | **매 클론** | `node_modules`는 저장소에 없음 |
| `hosts` → `local.app.dutying.net` | **필수** | dev 서버가 이 호스트에 바인딩됨 (`apps/app/vite.config.ts`) |
| 루트 `.env` | **필수** | API 연동용. 팀에서 받은 파일을 그대로 두는 방식이 일반적 |
| `VITE_SERVER_URL` | **필수** | 없으면 axios `baseURL`이 비어 로그인·API 호출 실패 |
| `VITE_APP_PUBLIC_URL` | **선택** | `https://local.app.dutying.net:3000`으로 접속하면 브라우저 origin으로 잡혀서 보통 생략 가능 |
| `local.dutying.net` hosts | **선택** | `pnpm dev:landing` 할 때만 필요 |
| HTTPS(mkcert) | **자동** | `pnpm dev` 첫 실행 시 처리. 방화벽 허용만 확인 |

`.env`는 **반드시 저장소 루트**에 둡니다. `apps/app` 아래가 아닙니다.

### 로그인이 안 될 때

`.env`보다 먼저 확인할 것:

- 브라우저 주소가 `https://local.app.dutying.net:3000` 인지 (`localhost:3000` 아님)
- `VITE_SERVER_URL`이 팀에서 쓰는 dev/staging API URL인지 (예: `https://dev.api.dutying.net`)
- 백엔드 OAuth allow-list에 로컬 앱 URL이 등록되어 있는지 (팀 문의)

---

## 요약

| 항목 | 권장 버전/값 |
|------|----------------|
| Node.js | **22.x** (CI와 동일) |
| pnpm | **10.12.4** (CI와 동일) |
| 패키지 매니저 | pnpm only (`npm install` / `yarn` 사용하지 않음) |
| 메인 앱 로컬 URL | `https://local.app.dutying.net:3000` |
| 랜딩 로컬 URL | `http://local.dutying.net:4321` |
| 문서 사이트 로컬 URL | `http://localhost:5173` |

---

## 1. 사전 준비

### 1.1 필수 도구

1. **Git for Windows**  
   - [https://git-scm.com/download/win](https://git-scm.com/download/win)  
   - 저장소 클론, 브랜치 작업에 필요합니다.

2. **Node.js 22.x**  
   - [https://nodejs.org/](https://nodejs.org/) LTS(22) 설치, 또는 **nvm-windows** / **fnm**으로 22.x 관리  
   - CI(`.github/workflows/vitest.yml`, `cypress.yml`)는 Node **22.x**를 사용합니다.

3. **pnpm 10.12.4**  
   - Corepack 사용(권장):

```powershell
corepack enable
corepack prepare pnpm@10.12.4 --activate
pnpm -v
```

   - Corepack이 안 되면:

```powershell
npm install -g pnpm@10.12.4
```

4. **에디터(선택)**  
   - VS Code / Cursor. TypeScript·ESLint 확장을 켜 두면 편합니다.

### 1.2 권장: Git Bash 또는 WSL2

- 일부 루트 스크립트는 `CI=1 ...` 형태의 **Unix 환경 변수 문법**을 씁니다(예: `pnpm run changeset:status`).  
  Windows **cmd**에서는 동작하지 않을 수 있습니다.
- 릴리즈/Changesets 작업은 **Git Bash** 또는 **WSL2**에서 실행하는 것을 권장합니다.
- 일반적인 `pnpm dev`, `pnpm test`, `pnpm lint`는 PowerShell에서도 문제 없습니다.

### 1.3 Windows Git 긴 경로(필요 시)

클론/체크아웃 시 경로 오류가 나면:

```powershell
git config --global core.longpaths true
```

---

## 2. 저장소 받기

```powershell
git clone https://github.com/gom-3/dutying-web.git
cd dutying-web
```

포크/사내 미러를 쓰는 경우 URL만 바꿉니다.

---

## 3. 로컬 hosts 설정 (필수)

메인 앱은 `local.app.dutying.net`, 랜딩은 `local.dutying.net`으로 뜹니다.

### 메인 앱만 (`pnpm dev`) — 이 한 줄이면 충분

```text
127.0.0.1 local.app.dutying.net
```

### 랜딩까지 (`pnpm dev:landing`) — 아래 두 줄

```text
127.0.0.1 local.app.dutying.net
127.0.0.1 local.dutying.net
```

공통 절차:

1. 메모장을 **관리자 권한**으로 실행  
2. `C:\Windows\System32\drivers\etc\hosts` 열기  
3. 위 표에 맞게 `hosts` 맨 아래에 추가  
4. 저장 후 DNS 캐시 갱신(선택):

```powershell
ipconfig /flushdns
```

브라우저에서 `https://local.app.dutying.net:3000` / `http://local.dutying.net:4321` 로 접속할 수 있어야 합니다.

---

## 4. 의존성 설치

저장소 **루트**에서 실행합니다.

```powershell
cd C:\path\to\dutying-web
pnpm install
```

### Puppeteer/Chrome 다운로드 실패 시

`apps/app`에 `puppeteer`가 포함되어 있어, 회사망·프록시 환경에서 설치가 실패할 수 있습니다. CI와 동일한 미러를 쓰려면 **PowerShell**에서:

```powershell
$env:PUPPETEER_DOWNLOAD_BASE_URL = "https://storage.googleapis.com/chrome-for-testing-public"
pnpm install
```

**cmd**에서는:

```cmd
set PUPPETEER_DOWNLOAD_BASE_URL=https://storage.googleapis.com/chrome-for-testing-public
pnpm install
```

lockfile과 동일하게 맞출 때:

```powershell
pnpm install --frozen-lockfile
```

---

## 5. 환경 변수 (.env)

Vite/Astro는 **모노레포 루트**의 env 파일을 읽습니다.

- `apps/app/vite.config.ts` → `envDir`가 workspace root
- `apps/landing` → `packages/config/load-root-env.mjs`로 루트 `.env*` 로드

`.env`는 `.gitignore`에 있어 **저장소에 없습니다**.  
신규 합류 시 팀 채널·Notion·1Password 등에서 **공유 `.env` 파일을 받아 루트에 복사**하는 것이 가장 빠릅니다.

### 5.1 최소로 꼭 필요한 값

로컬에서 메인 앱 + API 연동만 보면 아래가 핵심입니다.

| 변수 | 필수 | 설명 |
|------|------|------|
| `VITE_SERVER_URL` | **예** | API 베이스 URL. 팀 dev 환경 URL 사용 (예: `https://dev.api.dutying.net`) |
| `VITE_APP_PUBLIC_URL` | 아니오 | `https://local.app.dutying.net:3000`으로 접속 시 생략 가능 |

`VITE_SERVER_URL`이 없으면 `apps/app/src/shared/api/client.ts`의 axios `baseURL`이 비어 로그인·근무표 등이 동작하지 않습니다.

팀 `.env`에 `VITE_MAZE_KEY`, `VITE_FIREBASE_*` 등이 더 있어도 됩니다. 현재 `apps/app` 소스에서 직접 참조하지 않는 키가 포함될 수 있으며, **있어도 로컬 dev에 해가 되지는 않습니다**.

### 5.2 직접 만들 때 예시 (루트 `.env`)

팀 파일이 없을 때만 참고용으로 작성합니다.

```env
# 필수 — 팀에서 안내하는 API URL
VITE_SERVER_URL=https://dev.api.dutying.net

# 선택 — local.app.dutying.net:3000 으로 접속하면 보통 불필요
# VITE_APP_PUBLIC_URL=https://local.app.dutying.net:3000

# (선택) 프로필 이미지 S3 베이스
# VITE_PUBLIC_S3_BASE_URL=https://dutying-prod.s3.ap-northeast-2.amazonaws.com

# (선택) AI 근무표: mock | api (기본 api)
# VITE_AI_SCHEDULE_PROVIDER=mock

# (선택) 온보딩 미리보기 강제: true | false
# VITE_ALLOW_ONBOARDING_PREVIEW=true
```

### 5.3 랜딩 전용 (선택)

같은 루트 `.env`에 Astro public 변수를 함께 둘 수 있습니다.

```env
PUBLIC_MARKETING_SITE_URL=http://local.dutying.net:4321
PUBLIC_APP_SITE_URL=https://local.app.dutying.net:3000
PUBLIC_DOCS_SITE_URL=http://localhost:5173
```

미설정 시 `apps/landing/src/config/site.ts`의 프로덕션 기본값(`https://dutying.net` 등)으로 동작합니다.

### 5.4 프로덕션 분석·E2E (선택)

| 변수 | 용도 |
|------|------|
| `VITE_GA_TRACKING_ID` | Google Analytics (프로덕션 빌드) |
| `VITE_PIXEL_ID` | Meta Pixel (프로덕션 빌드) |
| `cypress.env.json` | E2E 계정 (`CYPRESS_id`, `CYPRESS_pw`, `CYPRESS_host` 등, `apps/app` 기준, gitignore) |

전체 Vite 변수 목록: `apps/app/src/vite-env.d.ts`

---

## 6. HTTPS 로컬 인증서 (mkcert)

메인 앱 dev 서버는 `vite-plugin-mkcert`로 **HTTPS**를 켭니다.

- 첫 `pnpm dev` 실행 시 로컬 CA/인증서가 생성될 수 있습니다.
- Windows 방화벽에서 **Node.js** 허용 여부를 물으면 허용합니다.
- 브라우저가 인증서를 신뢰하지 않으면:
  - dev 서버를 한 번 실행한 뒤
  - [mkcert](https://github.com/FiloSottile/mkcert) 문서에 따라 Windows 신뢰 저장소에 CA 설치  
  - 또는 팀에서 공유하는 mkcert CA 설치 절차를 따릅니다.

---

## 7. 개발 서버 실행

모든 명령은 **저장소 루트**에서 실행합니다.

### 7.1 메인 웹 앱 (기본)

```powershell
pnpm dev
# 동일: pnpm dev:app
```

- URL: **https://local.app.dutying.net:3000**
- 설정: `apps/app/vite.config.ts` (`host`, `port`, `mkcert`)

### 7.2 랜딩

```powershell
pnpm dev:landing
```

- URL: **http://local.dutying.net:4321**
- `hosts`에 `local.dutying.net`이 있어야 합니다.

### 7.3 문서 사이트 (VitePress)

```powershell
pnpm dev:docs
```

- URL: **http://localhost:5173** (`0.0.0.0:5173` 바인딩)

---

## 8. 자주 쓰는 명령어

| 목적 | 명령 |
|------|------|
| 단위 테스트 | `pnpm test` |
| 테스트 1회 실행 | `pnpm test:run` |
| 커버리지 | `pnpm coverage` |
| 린트 | `pnpm lint` |
| 타입 체크 | `pnpm type-check` |
| 포맷 | `pnpm format` |
| 워크스페이스 목록 | `pnpm workspace:list` |
| 프로덕션 빌드(앱) | `pnpm build` |
| 빌드 미리보기 | `pnpm preview` |
| E2E(Cypress UI) | `pnpm cypress:open` |
| E2E(서버+Cypress) | `pnpm e2e` |

앱별 타입 체크: `pnpm type-check:landing`, `pnpm type-check:docs`

---

## 9. 모노레포 구조 (참고)

```text
dutying-web/
├── apps/
│   ├── app/       # 메인 제품 (Vite + React) — 기본 dev 대상
│   ├── landing/   # 마케팅 사이트 (Astro)
│   └── docs/      # 사용자 가이드 (VitePress)
├── packages/
│   ├── api/
│   ├── config/
│   ├── domain/
│   └── utils/
└── docs/          # 아키텍처·운영 문서
```

신규 기능은 FSD에 가까운 레이어(`pages`, `features`, `entities`, `shared` 등)를 따릅니다.  
자세한 규칙: [README.md](../README.md), [codebase-structure.md](./architecture/codebase-structure.md)

---

## 10. 문제 해결

### `pnpm`을 찾을 수 없음

- 터미널을 새로 연 뒤 `pnpm -v` 확인  
- `corepack enable` 후 `corepack prepare pnpm@10.12.4 --activate`

### `local.app.dutying.net`에 연결되지 않음

- `hosts` 파일 저장 여부(관리자 권한)  
- `ipconfig /flushdns`  
- VPN/사내 DNS가 `*.dutying.net`을 가로채지 않는지 확인

### API/CORS/쿠키 오류

- 접속 URL이 `https://local.app.dutying.net:3000` 인지 확인 (`localhost` 사용 시 OAuth·쿠키 문제 가능)  
- 루트 `.env`의 `VITE_SERVER_URL` 확인 (`VITE_APP_PUBLIC_URL`은 보통 불필요)  
- 백엔드 OAuth allow-list에 로컬 앱 URL이 등록되어 있는지 팀에 확인  
- axios는 `withCredentials: true`이므로 API 도메인·쿠키 정책이 맞아야 합니다.

### `pnpm install`이 느리거나 puppeteer에서 멈춤

- [4. 의존성 설치](#4-의존성-설치)의 `PUPPETEER_DOWNLOAD_BASE_URL` 설정  
- 회사 프록시가 있으면 `npm config set proxy` / `https-proxy` 설정

### 포트 3000 / 4321 사용 중

- 해당 포트를 쓰는 프로세스 종료 후 다시 `pnpm dev`  
- 또는 작업 관리자에서 `node` 프로세스 확인

### 릴리즈 스크립트(`changeset:status` 등) 실패

- PowerShell 대신 **Git Bash**에서:

```bash
CI=1 pnpm run changeset:status
```

### Node 버전 불일치

```powershell
node -v   # v22.x 권장
```

nvm-windows 예:

```powershell
nvm install 22
nvm use 22
```

---

## 11. 관련 문서

- [README.md](../README.md) — 워크스페이스 개요·명령어
- [landing-app-split.md](./landing-app-split.md) — 랜딩/앱 도메인 분리·로컬 호스트
- [release-automation.md](./release-automation.md) — Changesets·릴리즈 (주로 Git Bash/WSL)
- [codebase-structure.md](./architecture/codebase-structure.md) — 폴더·레이어 규칙

---

## 12. 체크리스트

로컬에서 **메인 앱**까지 확인할 때:

- [ ] Node 22.x, pnpm 10.12.4 설치 (PC당 1회)
- [ ] `git clone` → 루트에서 `pnpm install` 성공
- [ ] `hosts`에 `local.app.dutying.net` 추가
- [ ] 루트에 팀 `.env` 복사 (`VITE_SERVER_URL` 포함)
- [ ] `pnpm dev` 후 https://local.app.dutying.net:3000 접속
- [ ] (선택) `pnpm test`, `pnpm lint`, `pnpm type-check` 통과

랜딩까지 볼 때만 `hosts`에 `local.dutying.net` 추가.

문서 수정 제안은 PR 또는 팀 채널로 공유해 주세요.
