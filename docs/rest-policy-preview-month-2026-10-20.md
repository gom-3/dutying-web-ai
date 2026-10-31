# 휴무 계산 월 선택 수정

휴무 계산 화면은 현재 연월을 useMemo로 고정하여 다음 달 미리보기를 볼 수 없다.
미리보기 연월을 화면 상태로 관리하고 이전/다음 달 이동을 제공한다. 12월/1월 경계를 처리하고,
선택한 월로 기본 휴무 및 공휴일을 다시 계산한다. 월 이동은 병동 정책 수정이 아니므로 저장이나 dirty 상태를 발생시키지 않는다.
기존 번역의 월 표기와 이동 버튼 이름을 재사용한다. DB/API 변경 및 Flyway migration 없음.

나이트 배치·고정 휴무·여유 인원 배치는 별도 조사 대상이다. 실제 병동 규칙 확인 없이 개인의 허용 근무를 바꾸거나
연차를 자동 소진하지 않는다. 기본 D/E/N 최소 3/3/2와 E 우선 추가 배치, 월 O 9일 및 별도 연차 요구를 구분한다.

## 휴무 요청 계약 정정 (2026-10-28)

이 문서의 이전 `targetMode=fixed → exactForRegularWorkers=true` 해석은 폐기했다.
고정 모드는 월 기준값을 계산하는 방법이며, 일반근무자의 OFF 상한을 별도로 지정한 것이 아니다.
화면은 `minimumDaysByShiftNurseId`와 `countedWardShiftTypeIds`를 전송하고 exact 상한을 자동으로 추가하지 않는다.
명시적인 API `exactForRegularWorkers=true`와 개인별 HARD EXACT 규칙은 계속 지킨다.
기준값 초과 OFF를 연차로 바꾸거나 연차를 자동 소진하지 않는다.
현행 계약과 검증 기준은 [고정 휴무 요청 계약](fixed-rest-calculation-request-contract-2026-10-28.md)과
[회귀 방지 검증](rest-contract-regression-checks-2026-10-28.md)을 따른다.

아래 검증 수치는 10월 20일 당시 실행 기록이다. 현행 계약 보장의 근거로 사용하지 않는다.
검증: 월 이동/정책 UI 8개, 휴무 계산 모델19개, 고정 휴무 요청3개, 생성 요청 전달1개 및 TypeScript build 검사 통과.
