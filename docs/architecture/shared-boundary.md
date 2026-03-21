# shared 경계 기준

## 목적
- `shared`는 어떤 도메인에서도 재사용 가능한 범용 코드만 둔다.
- 화면 흐름, 병동/근무표 같은 업무 맥락이 섞이면 `shared`가 아니라 상위 slice로 올린다.

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
- `Button`, `Select`, `TextField`, `TimeInput` preset은 primitive 조합에 가깝고 범용성이 낮아 `widgets/form-controls`로 이동
- `shared/ui/primitives/*`는 도메인 비특화 기반 컴포넌트이므로 유지

## 이후 체크리스트
- 새 모듈이 `shared`에 들어갈 때 도메인 타입 import가 필요한지 먼저 확인
- 특정 페이지 레이아웃이나 입력 패턴을 전제하면 `widgets` 또는 더 가까운 slice에 둔다
- 공용화가 필요하면 먼저 primitive와 preset을 분리한 뒤 shared 편입을 검토한다
