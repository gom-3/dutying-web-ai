# Dutying Web

## Release Verification Skill

- 웹 운영 배포, 배포 제공자 실패, `main` 미반영, 웹 장애, 릴리즈 브랜치 검증 또는 실제 프런트엔드 반영 확인 요청은 `.codex/skills/dutying-web-release-verify/SKILL.md`를 먼저 끝까지 읽고 따른다.
- 배포 완료는 제공자의 배포 커밋과 공개 URL·변경 화면을 함께 확인한 경우에만 선언한다. 공개 응답 검증에는 `.codex/skills/dutying-web-release-verify/scripts/verify-public-release.sh`를 사용한다.

## 개발계 CI/CD

- “CI/CD 해줘”, “develop 배포해줘”, “개발계 CI/CD 돌려줘”는 [개발계 수동 배포 절차](docs/DEV-DEPLOYMENT.md)를 따른다. 요청 대상은 이 저장소의 `origin/develop`과 개발용 Cloudflare Pages 프로젝트 `dutying-web-ai-dev`다.
- `develop` 푸시와 GitHub Web CI는 검증을 실행한다. 개발 배포 요청을 받으면 팀원의 Cloudflare 세션에서 대상 SHA의 `skipped` 기록을 찾아 **Retry deployment**를 실행하고, 공개 개발 URL의 `release.json`에서 같은 SHA가 확인될 때 완료로 보고한다. 개발 프로젝트의 자동 배포는 비활성 상태로 운영한다.
