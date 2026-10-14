# 지난달 확정 근무 연결

`GET /wards/{wardId}/shift-teams/{shiftTeamId}/duty` 응답의 `previousConfirmedSnapshotId`를 사용한다. 숫자이면 `lastWardShiftList`의 배정된 칸이 지난달 최신 확정값이며 읽기 전용이다. null은 확정본 없음, 필드 없음은 구 API로 구분한다. 구 API에서는 전달 /duty의 CONFIRMED 상태와 nurseId를 사용한다.

확정 값 > 확정 값이 없는 날짜의 수동 입력 > 빈칸 순서로 병합한다. 기존 임시저장 빈칸은 확정 값을 가리지 않으며, 재확정 후 전달 근무만 갱신하고 이번 달 cells/핀/이력을 보존한다. 지난 확정값을 지운 재확정도 기존 자동 입력값을 제거한다.

확정/재확정 후 해당 달 및 다음 달 duty와 다음 달 workspace를 invalidate한다. 진입/재활성화에 최신 데이터를 조회한다. 조회 실패는 데이터 없음과 구분하고, 생성·확정 대신 재시도를 안내한다.

셀 쓰기/붙여넣기/undo/redo는 lastCellLocks를 공통으로 지킨다. 저장 버전의 역사적 표시 데이터는 현재 근무표로 덮어쓰지 않는다.

서버를 먼저 반영한다. DB 변경은 없다. 관련 웹 회귀 테스트 204개, TypeScript 검사, Vite 빌드 통과. 새 소스 모듈 린트 통과. 기존 AI 화면의 린트 이슈는 baseline과 비교해 새 이슈가 없는지 확인한다.
