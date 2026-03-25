# Changesets

이 저장소는 Changesets로 웹 앱 릴리즈 버전과 루트 `CHANGELOG.md`를 관리합니다.

## 기본 흐름

```bash
pnpm run changeset:add
pnpm run changeset:check
```

- 사용자 영향이 있는 웹 앱/공통 패키지 변경이면 PR에 changeset 파일을 포함합니다.
- 문서, CI, 릴리즈 자동화, 설정만 바뀐 PR은 `pnpm run changeset:check`가 자동으로 changeset 필요 여부를 판단합니다.
- `develop`에 머지되면 `release-pr.yml`이 pending changesets를 모아 release PR을 자동 생성하거나 갱신합니다.
- release PR이 머지되면 workspace 버전, 루트 `package.json`, 루트 `CHANGELOG.md`가 함께 반영됩니다.

## 참고 문서

- 작성 가이드: [`docs/development/changesets.md`](../docs/development/changesets.md)
- 릴리즈 자동화: [`docs/release-automation.md`](../docs/release-automation.md)
- 공식 문서: [changesets/changesets](https://github.com/changesets/changesets)
