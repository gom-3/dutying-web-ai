# 근무표 작성 단계 고정 통합 백엔드/DB 검토 요청

## 배경

프론트에서는 별도 `고정 근무` 단계를 사용자 흐름에서 제거하고, `근무표 작성하기` 화면 안에서 직접 근무를 입력한 뒤 필요한 칸만 `고정`할 수 있게 변경했다.

사용자 기준 새 흐름은 다음과 같다.

1. 근무자 확인
2. 제약조건
3. 신청 근무 확정
4. 근무표 작성하기
5. 확정 근무표

프론트는 레거시 단계값을 호환하지 않고, 아래 5단계 체계를 실제 기준으로 사용한다.

- `4 = 근무표 작성하기`
- `5 = 확정 근무표`
- `6`은 더 이상 유효한 확정 단계로 사용하지 않는다.

## 프론트 구현 요약

- 작성 화면에서 선택한 셀을 `fixedCells`에 추가/제거한다.
- 신청근무(`requestCells`)는 사용자가 고정/해제할 수 없고, 항상 보호 대상이다.
- AI 자동채우기 요청은 기존 `lockedCellKeys` 계산을 사용하므로 `requestCells`와 `fixedCells`가 모두 AI 보호 대상으로 들어간다.
- 첫 자동채우기 전 고정하지 않은 작성 근무가 있으면 모달로 선택하게 한다.
  - `고정하고 채우기`: 현재 작성된 비보호 근무를 고정한 뒤 AI 실행
  - `비우고 새로 생성`: 신청/고정 외 작성 근무를 비운 뒤 AI 실행
- AI 결과 후 다시 생성할 때 사용자가 수정한 비고정 근무가 있으면 모달로 선택하게 한다.
  - `수정한 칸 고정`: AI 결과 이후 바뀐 칸만 고정하고 나머지를 다시 생성
  - `수정한 칸도 다시 생성`: 신청/고정 외 칸을 비우고 다시 생성

## 현재 계약으로 가능한 부분

현재 프론트 코드 기준으로는 MVP에 신규 DB가 필수는 아니다.

- snapshot cell에 `fixed` 값을 담을 수 있다.
- autofill DTO에 `lockedCellKeys`를 보낼 수 있다.
- snapshot 저장/불러오기에서 fixed 상태를 보존할 수 있다.
- publish는 snapshot 기준으로 확정할 수 있다.

## 백엔드 확인 필요사항

1. AI 자동채우기가 `lockedCellKeys`에 포함된 셀을 절대 변경하지 않는지 확인 필요.
2. `cells[].fixed = true`인 셀도 서버 쪽 validation/autofill에서 보호 대상으로 일관되게 다루는지 확인 필요.
3. AI 응답의 `changedCells`에 신청근무/고정근무 셀이 포함되지 않는지 확인 필요.
4. snapshot 저장/조회 시 `fixed` 값이 누락 없이 왕복되는지 확인 필요.
5. 서버 workflow step 저장/조회가 새 단계 체계와 맞는지 확인 필요.
   - 작성 중: `workflowStatus = IN_PROGRESS`, `workflowStep = 1~4`
   - 확정: `workflowStatus = CONFIRMED`, `workflowStep = 5`

## DB가 필요한 경우

아래 요구사항을 MVP 범위에 넣는다면 별도 draft 저장 DB가 필요하다.

- 다른 기기에서 작성 중이던 고정/수정 상태를 이어서 작업해야 함
- 브라우저 localStorage가 사라져도 작성 중인 근무표를 복구해야 함
- 여러 관리자가 같은 근무표를 동시에 편집하거나 최신 draft를 공유해야 함
- AI 실행 전후의 draft 상태를 서버 기준으로 감사/추적해야 함

이 경우 draft 저장 테이블 또는 JSON 컬럼에 최소한 아래 값이 필요하다.

- wardId
- shiftTeamId
- year
- month
- cells
- rowOrder
- fixed 상태
- request 보호 상태 또는 request snapshot 참조
- workflowStatus
- workflowStep
- updatedAt

## 결론

프론트 MVP는 기존 계약으로 구현 가능하다. 백엔드/DB 작업은 당장 필수라기보다, `lockedCellKeys`와 snapshot `fixed` 보존을 검증하는 것이 우선이다.

다만 서버 자동저장, 기기 간 이어쓰기, 다중 관리자 편집을 제품 범위로 넣는다면 별도 draft DB 설계가 필요하다.
