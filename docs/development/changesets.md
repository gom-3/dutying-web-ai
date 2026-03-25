# Changeset Guide

## 언제 작성하나

- `apps/app`의 사용자 동작이나 화면 결과가 달라질 때
- `packages/api`, `packages/domain`, `packages/utils` 변경으로 웹 앱 동작이 달라질 때
- 릴리즈 노트에 남겨야 하는 운영 안정화나 버그 수정이 있을 때

다음만 있는 경우는 보통 생략합니다.

- 문서 사이트(`apps/docs`), 랜딩(`apps/landing`) 수정
- CI, 릴리즈 자동화, 설정 파일만 변경
- 테스트만 추가하거나 리팩터링만 있고 동작 변화가 없는 경우

헷갈리면 일단 추가하는 쪽으로 맞추고, `pnpm run changeset:check` 결과를 함께 확인합니다.

## 작성 방법

```bash
pnpm run changeset:add
```

프롬프트가 뜨면 이 저장소의 변경 대상 workspace를 선택하고 변경 유형을 고릅니다.

- `patch`: 버그 수정, 작은 UX 수정, 운영 안정화
- `minor`: 새 기능 추가, 사용자 경험 개선, 눈에 띄는 스펙 확장
- `major`: 기존 동작과 호환되지 않는 변경

이 저장소는 fixed version monorepo라 선택한 workspace와 함께 관련 workspace 버전이 같은 버전으로 정렬됩니다.

## 문장 작성 기준

- 릴리즈 노트에 바로 들어가도 되는 결과 중심 문장으로 작성합니다.
- 구현 상세보다 사용자/운영 관점의 결과를 적습니다.
- 여러 작업이 섞였으면 가장 중요한 결과 하나로 요약합니다.

좋은 예시:

- `근무표 저장 실패 원인을 화면에서 바로 확인할 수 있도록 에러 메시지 흐름을 개선했습니다.`
- `근무 요청 편집 화면에서 특정 교대조 데이터가 누락되던 문제를 수정했습니다.`
- `공통 날짜 계산 유틸을 정리해 근무표 검증 결과가 더 안정적으로 계산되도록 개선했습니다.`

피해야 할 예시:

- `fix bug`
- `리팩터링`
- `코드 정리`
- `config 수정`

## PR 전에 확인할 것

```bash
pnpm run changeset:check
```

- release-relevant 변경인데 changeset이 빠졌는지 확인합니다.
- 문서/CI/자동화 변경이면 changeset 없이 통과할 수 있습니다.
- release PR이나 버전 bump PR처럼 버전만 바뀌는 경우도 통과해야 정상입니다.

## 릴리즈 흐름

1. 기능 PR에 changeset 파일을 포함해 `develop`으로 머지합니다.
2. `release-pr.yml`이 pending changesets를 기준으로 release PR을 자동 생성하거나 갱신합니다.
3. release PR에는 workspace 버전, 루트 `package.json`, 루트 `CHANGELOG.md`, consumed `.changeset` 정리가 포함됩니다.
4. release PR을 머지하면 다음 웹 릴리즈 기준 버전이 확정됩니다.
