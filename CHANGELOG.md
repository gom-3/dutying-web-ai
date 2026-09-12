# CHANGELOG

Repository-level release notes for `dutying-web`.

This repository uses one shared version across all workspaces, so release notes are maintained only in this root file. Package-level changelogs are intentionally disabled.

Entries are generated from pending `.changeset/*.md` files when `pnpm run changeset:version` or `pnpm run release:version` is executed.

## 1.1.0 - 2026-09-12

- `@dutying/config` (minor), `@dutying/docs` (minor): 공용 설정 패키지와 docs 워크스페이스를 초기 분리합니다.
- `@dutying/app` (minor): 근무표 확인 및 편집을 위한 duty 페이지를 추가하고 관련 편집 흐름을 개선합니다.
- `@dutying/app` (patch): 문의하기가 웹에서 선택한 6개 언어를 채널톡에 전달하고 페이지 안에서 상담창을 열도록 개선합니다.
- `@dutying/app` (patch): 근무가 없는 칸에 남아 있던 고정 표시를 떼어 냅니다. 옛 버전을 불러온 뒤 자동완성이 그 달 전체를 실패하던 문제를 고칩니다.
- `@dutying/app` (patch): 자동완성 조절 칩을 dev·로컬에서 기본으로 켭니다. 운영 API 뒤에서는 그대로 감춰집니다.
- `@dutying/app` (patch): Apply the website language before opening Channel Talk for returning visitors.
- `@dutying/app` (minor): 센트리 추적 추가

## 1.0.2 - 2026-08-27

- `@dutying/app` (patch), `@dutying/landing` (patch): Localize AI web landing and login assets, and add legal pages for the landing site.
