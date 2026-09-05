# CHANGELOG

Repository-level release notes for `dutying-web`.

This repository uses one shared version across all workspaces, so release notes are maintained only in this root file. Package-level changelogs are intentionally disabled.

Entries are generated from pending `.changeset/*.md` files when `pnpm run changeset:version` or `pnpm run release:version` is executed.

## 1.1.0 - 2026-09-05

- `@dutying/config` (minor), `@dutying/docs` (minor), `@dutying/landing` (minor): 공용 설정 패키지와 별도 landing, docs 워크스페이스를 초기 분리합니다.
- `@dutying/app` (minor): 근무표 확인 및 편집을 위한 duty 페이지를 추가하고 관련 편집 흐름을 개선합니다.
- `@dutying/api` (patch), `@dutying/app` (patch): 온보딩 제약 후보의 확인 상태와 원본 강도 권고를 서버에 전달해, 확인 전 안전 규칙이 HARD로 저장되지 않도록 개선합니다.
- `@dutying/app` (minor): 센트리 추적 추가

## 1.0.2 - 2026-08-27

- `@dutying/app` (patch), `@dutying/landing` (patch): Localize AI web landing and login assets, and add legal pages for the landing site.
