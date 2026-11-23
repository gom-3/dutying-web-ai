# Dutying Web 개발계 배포

“CI/CD 해줘”, “develop 배포해줘”, “개발계 CI/CD 돌려줘”는
`gom-3/dutying-web-ai`의 `origin/develop`을 `dev.dutying.ai`에
배포하라는 요청이다. “CI만”은 테스트와 빌드 검증까지다.

| 항목 | 대상 |
| --- | --- |
| Git 브랜치 | `origin/develop` |
| 개발용 Pages 프로젝트 | [dutying-web-ai-dev](https://dash.cloudflare.com/53466deaa5db27ed5bbeca1377a9e721/pages/view/dutying-web-ai-dev) |
| 개발 웹 / API | `https://dev.dutying.ai` / `https://dev.api.dutying.ai` |
| 권한 | GitHub 저장소 읽기와 조직의 개발용 Cloudflare Pages 배포 권한 |

## develop 푸시 자동 배포 확인 · 2026-11-23

사용자는 담당자가 `develop` 푸시의 Cloudflare 자동 배포 연결을 다시 설정했다고 전달했다. 신규 푸시 후 실제 제공자 커밋과 공개 응답으로 동작을 검증한다. GitHub 테스트 성공만으로 배포 완료를 판단하지 않는다.

- 결제 UI 변경: PR #217, `5b6d5ec4a1ca4364f2a4bc28351766cb8d929994`.
- 서버 현행 Plus 환불 검증 보완: 서버 PR #423, `be7aec2ff470d718c536caba569074f652afb84d` (서버 배포는 별도 workflow).
- 확인할 공개 경로: `/billing`, `/billing/billing-return`, `/billing/payment-return` 및 동일 커밋의 `release.json`.
- 자동 배포가 시작되지 않을 때는 아래 수동 Pages 절차를 대체 경로로 사용한다. 이미 진행 중인 동일 커밋 배포는 중복 실행하지 않는다.

## 1. 배포할 커밋 검증

- 원격 `develop`의 전체 SHA를 확인한다. 같은 커밋이 이미 공개 도메인과 고유 Pages URL에 반영됐다면 그 결과를 확인한다.
- 해당 SHA의 Web CI에서 `test` job의 성공을 우선 사용한다. 구 워크플로가 배포 확인 단계에서만 실패했어도 `test` 결과는 재사용한다. 테스트나 빌드가 실패했다면 원인을 해결한 뒤 진행한다. 결과가 없다면 Node.js 22와 pnpm 10.12.4로 [Web CI의 test job](../.github/workflows/vitest.yml)에 있는 설치, 번역·릴리스 검사, Vitest, 개발 URL을 사용한 빌드, 결제 경로 검사를 로컬에서 수행한다. Actions 사용이 가능한 경우 필요한 검증을 `Web CI`의 `develop` 수동 실행으로 수행할 수도 있다.
- 다른 개발 배포가 진행 중이면 종료를 기다린다. 배포 시작 직전에 원격 SHA를 재확인한다. 검증한 커밋보다 새 커밋이 들어왔으면 배포 대상부터 다시 확인한다.

## 2. Cloudflare Pages에서 한 번 실행

- `dutying-web-ai-dev`의 **Deployments**에서 브랜치와 전체 SHA가 일치하는 `skipped` 배포를 연다. 이 프로젝트에서 `develop`은 **Production branch**로 표시되며 연결 도메인은 `dev.dutying.ai`다.
- **Manage deployment → Retry deployment**로 해당 커밋의 빌드를 한 번 시작한다. Cloudflare Git 빌드가 프로젝트에 저장된 설정으로 동작한다. GitHub Web CI는 개발 배포를 시작하지 않으며, 이 Pages 경로에는 GitHub 업로드 토큰이 필요 없다.
- 해당 SHA의 기록이 없거나 Pages 권한 또는 수동 실행 옵션이 없다면, 개발 프로젝트 권한이 있는 팀원에게 프로젝트·브랜치·전체 SHA를 전달한다. 실패 시 빌드 로그나 권한 오류를 공유한다. 자동 배포 설정이 다시 비활성화된 경우에도 이 수동 절차로 개발 프로젝트만 배포한다.

## 3. 실제 반영 확인

Pages의 성공 상태, 전체 SHA, 고유 배포 URL을 확인한다. 아래는 저장소 루트에서 실행한다.

```bash
set -e
sha='<배포 대상 전체 Git SHA>'
pages_url=$(node scripts/release/existing-pages-deployment.mjs \
  https://dev.dutying.ai "$sha" develop dutying-web-ai-dev)
verifier=.codex/skills/dutying-web-release-verify/scripts/verify-public-release.sh
bash "$verifier" --url https://dev.dutying.ai/release.json --expect-text "$sha"
bash "$verifier" --url "$pages_url/release.json" --expect-text "$sha"
```

변경된 화면이나 경로도 공개 개발 사이트에서 확인한 뒤 커밋, 검증 결과,
Pages 배포 링크와 실제 확인 범위를 공유한다. GitHub 테스트 성공이나 Cloudflare
빌드 시작만 확인된 경우에는 배포 확인이 남아 있다고 보고한다.
