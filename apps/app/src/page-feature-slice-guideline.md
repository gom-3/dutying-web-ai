# Page / Feature Slice Guideline

- `pages/*`, `features/*` 내부는 기본적으로 `index.ts(x)` + `ui/` + `model/` 구조를 사용한다.
- `ui/`에는 화면 조합 컴포넌트와 페이지 전용 표시 로직을 둔다.
- `model/`에는 hook, store, adapter, type, 순수 계산 로직을 둔다.
- 하위 단계가 늘어나면 `ui/steps`, `model/__tests__`처럼 `ui/` 또는 `model/` 아래에서만 확장한다.

## Deprecated

- 신규 page/feature 내부 루트에 `view/`, `components/`, `hooks/`를 병렬로 두는 패턴
- 여러 model 성격 파일을 slice 루트에 평평하게 나열하는 패턴

## Reference

- `pages/duty`: `ui/` + `model/`
- `pages/make-shift`: `ui/` + `model/`
- `pages/onboarding-ward-create`: `ui/steps` + `model/`
- `features/account`: `model/`
