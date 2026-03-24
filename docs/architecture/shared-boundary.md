# shared 경계 기준

## 목적

- `shared`는 어떤 도메인에서도 재사용 가능한 범용 코드만 둔다.
- 화면 흐름, 병동/근무표 같은 업무 맥락이 섞이면 `shared`가 아니라 상위 slice로 올린다.
- workspace 전체에서 재사용할 계약, 모델, 순수 유틸은 `packages/*`가 소유한다.

## app shared vs packages

- `apps/app/src/shared/*`
    - 현재 app 런타임에 직접 묶인 코드만 둔다.
    - 예: 브라우저/라우터/토스트 의존성이 있는 API client, 앱 URL/runtime config, app 테스트 유틸
- `packages/api`
    - 특정 앱 구현과 분리 가능한 API 계약과 생성 함수를 둔다.
    - DTO, response type, `create*Api` 같은 browser-agnostic adapter factory를 포함한다.
- `packages/domain`
    - 화면/전송 방식과 무관한 업무 모델 타입을 둔다.
- `packages/utils`
    - app 문맥 없는 순수 유틸과 범용 타입을 둔다.
- `packages/config`
    - workspace 공통 빌드/TS/ESLint 설정만 둔다.

## ownership 판단 질문

- 이 코드가 브라우저 전역, router, toast, `import.meta.env` 같은 app 런타임을 직접 아는가?
    - 그렇다면 `apps/app/src/shared/*`
- 이 코드가 다른 app에서도 같은 계약/로직으로 재사용 가능한가?
    - 그렇다면 `packages/*`
- 이 코드가 단순 재수출 없이도 package를 직접 import 할 수 있는가?
    - 그렇다면 app shared에 compat layer를 만들지 말고 package를 바로 사용한다.

## shared에 남길 것

- 도메인 지식 없이 사용할 수 있는 primitive UI
- 문자열, 날짜, 스타일 조합 같은 범용 유틸
- 특정 화면의 레이아웃이나 폼 스타일을 전제하지 않는 추상화

## shared에서 빼야 할 것

- `TShift`, `TWardConstraint`처럼 특정 도메인 모델을 직접 아는 유틸
- 근무표 다운로드, 신청근무 편집처럼 업무 플로우를 수행하는 로직
- 앱 특정 폼 패턴을 강하게 고정한 preset UI
    - 예: 큰 pill 버튼, 고정 폭 select, 대형 입력 필드, 시간 입력 formatter

## 이번 정리 기준

- `shiftToExcel`은 근무표 도메인과 엑셀 내보내기 플로우를 함께 알아야 하므로 `features/shift-editor/model`로 이동
- `Button`, `Select`, `TextField`, `TimeInput`은 도메인 UI는 아니지만 primitive와 역할이 다르므로 `shared/ui/form-controls`로 분리
- `shared/ui/primitives/*`는 도메인 비특화 기반 컴포넌트이므로 유지
- `shared/types/*`에 있던 범용 타입과 API 응답 타입은 각각 `packages/utils`, `packages/api`로 이동
- app 코드가 `shared/api/*/type` 같은 재수출 레이어 대신 `@dutying/api/*`를 직접 import 하도록 정리

## 이후 체크리스트

- 새 모듈이 `shared`에 들어갈 때 도메인 타입 import가 필요한지 먼저 확인
- 새 모듈이 app runtime 없이도 성립하면 `packages/*`로 먼저 검토
- 특정 페이지 레이아웃이나 입력 패턴을 전제하면 `widgets` 또는 더 가까운 slice에 둔다
- 공용화가 필요하면 먼저 primitive와 preset을 분리한 뒤 shared 편입을 검토한다
