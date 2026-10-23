# @dutying/app

## 1.3.17

### Patch Changes

- 5e92894: 월 휴무와 근무 인원 상한의 충돌을 구체적인 횟수로 설명하고 검증된 수정 제안과 다음 선택을 안내합니다.
- Updated dependencies [5e92894]
    - @dutying/api@1.3.17
    - @dutying/domain@1.3.17
    - @dutying/utils@1.3.17

## 1.3.16

### Patch Changes

- d58b70b: 전화번호를 입력하지 않은 병동 연동 신청도 대기 목록에서 확인하고 팀에 추가할 수 있도록 수정했어요.
- Updated dependencies [d58b70b]
    - @dutying/domain@1.3.16
    - @dutying/api@1.3.16
    - @dutying/utils@1.3.16

## 1.3.14

### Patch Changes

- aa7f1a5: 자동채우기 채팅 시트에 일본어 안내, 요청 예시, 조건 검토, 결과 비교 및 피드백 문구를 추가합니다.
    - @dutying/api@1.3.14
    - @dutying/domain@1.3.14
    - @dutying/utils@1.3.14

## 1.3.13

### Patch Changes

- 0cfe9e5: 자동완성·조절의 충돌 제안에서 요청 변경 후 다른 선택, 적용 진행 표시, 실패 재시도와 만료 안내를 개선합니다.
- 308ba4b: AI가 만든 결과의 검사 실패를 사용자 조건 충돌과 구분해 안내하고, 조건 수정 대신 다시 시도할 수 있도록 합니다.
    - @dutying/api@1.3.13
    - @dutying/domain@1.3.13
    - @dutying/utils@1.3.13

## 1.3.12

### Patch Changes

- 3deabdc: 자동완성 결과 적용 후 만족도와 선택 의견을 보낼 수 있습니다.
- 03cc09b: 요청 확인 화면에서 현재 근무표 전체·저장된 그룹·지정 간호사의 실제 적용 대상을 인원과 이름으로 표시합니다.
    - @dutying/api@1.3.12
    - @dutying/domain@1.3.12
    - @dutying/utils@1.3.12

## 1.3.11

### Patch Changes

- 625a554: 자동완성과 조절에서 이해한 요청과 충돌 이유를 설명하고, 설정 수정·검증된 제안 적용·요청 변경 중 진행 방법을 선택합니다.
- Updated dependencies [625a554]
    - @dutying/api@1.3.11
    - @dutying/domain@1.3.11
    - @dutying/utils@1.3.11

## 1.3.10

### Patch Changes

- 자동채우기 실패 이유와 수정할 조건을 안내하고, 충돌하는 조건을 확인한 뒤 이번 결과에만 예외 적용 여부를 선택할 수 있습니다.
- Updated dependencies
    - @dutying/api@1.3.10
    - @dutying/domain@1.3.10
    - @dutying/utils@1.3.10

## 1.3.9

### Patch Changes

- 휴무 계산 월 이동과 일반 근무자 고정 휴무 요청을 지원하고, 필수 규칙을 위반한 AI 근무표가 적용되지 않도록 차단합니다.
- Updated dependencies
    - @dutying/api@1.3.9
    - @dutying/domain@1.3.9
    - @dutying/utils@1.3.9

## 1.3.8

### Patch Changes

- ac0ecc9: 기존 근무표를 수정하는 자동채우기에서도 계산 중 로딩 모달을 표시합니다. 오른쪽 대화창을 유지하고 성공·실패 결과가 도착하면 모달을 닫습니다.
    - @dutying/api@1.3.8
    - @dutying/domain@1.3.8
    - @dutying/utils@1.3.8

## 1.3.7

### Patch Changes

- 자연어 조절의 필수·권장 선택과 검증된 카탈로그 설명을 지원하고, 미저장 변경과 설명이 없는 조건의 실행을 막습니다.
- 공개 Plus 요금 응답 검증과 준비 상태 안내를 보완합니다.
- Updated workspace dependencies to 1.3.7.

## 1.3.6

### Patch Changes

- 7ea10f7: 자동채우기 대화와 진행·결과 화면을 정리하고, 제약조건 편집과 결과 의견 작성을 모달로 제공합니다. 이전 결과의 미리보기와 변경 비교, 조건 삭제 및 실행 준비 이후 계획 갱신을 안전하게 연결합니다.
    - @dutying/api@1.3.6
    - @dutying/domain@1.3.6
    - @dutying/utils@1.3.6

## 1.3.5

### Patch Changes

- 68d2cdd: Show independent plan restriction states and distinguish unrestricted AI use from exhausted allowance.
    - @dutying/api@1.3.5
    - @dutying/domain@1.3.5
    - @dutying/utils@1.3.5

## 1.3.4

### Patch Changes

- 73647eb: Separate billing access from existing ward plan limits while preserving older-server behavior.
    - @dutying/api@1.3.4
    - @dutying/domain@1.3.4
    - @dutying/utils@1.3.4

## 1.3.3

### Patch Changes

- b9ae084: 휴무가 허용되지 않은 간호사의 이름과 구성원 설정 확인 방법을 안내하고, 작성 중인 표를 유지한 채 설정을 새 탭에서 열 수 있습니다.
- 3dc4762: 새 결과 의견을 작성할 때 이전 신고 접수 안내를 지워 아직 보내지 않은 의견과 구분하고, 과거 계산 완료를 현재 표 반영과 구분합니다.
- ecd8ed4: 근무자 이름의 입력 오류를 저장 전에 안내하고, 기본정보 저장이 거절되면 가능근무 변경도 보내지 않도록 수정했습니다. 기존 이름을 그대로 둔 정보 편집은 계속 사용할 수 있습니다.
- 7d27d62: 날짜·요일별 개인 배정 제한을 인원수 설정과 분리하고, 저장된 조건도 직원·적용일·근무만 선택하는 문장으로 표시합니다.
- 6077e23: 자동완성·조절 결과의 화면 표시와 표 적용을 운영 기록에 연결합니다.
- e3aa45b: 결과 의견 전송 실패 후 새로고침하더라도 같은 탭에서 24시간 안에 같은 내용을 다시 입력하면 세션에 보관한 신고 키를 복구해, 지원하는 서버에서 중복 접수를 방지합니다.
- 6a10a51: 자동채우기·조절 결과마다 변경 범위와 의견 대상을 안내하고, 의견 입력과 전송 후 키보드 초점을 보존합니다.
- Updated dependencies [b9ae084]
- Updated dependencies [6077e23]
    - @dutying/api@1.3.3
    - @dutying/domain@1.3.3
    - @dutying/utils@1.3.3

## 1.3.2

### Patch Changes

- 5d1e65f: 자동완성·조절 결과의 화면 표시와 표 적용을 운영 기록에 연결합니다.
- Updated dependencies [5d1e65f]
    - @dutying/api@1.3.2
    - @dutying/domain@1.3.2
    - @dutying/utils@1.3.2

## 1.3.1

### Patch Changes

- 99c29f6: 휴무가 허용되지 않은 간호사의 이름과 구성원 설정 확인 방법을 안내하고, 작성 중인 표를 유지한 채 설정을 새 탭에서 열 수 있습니다.
- Updated dependencies [99c29f6]
    - @dutying/api@1.3.1
    - @dutying/domain@1.3.1
    - @dutying/utils@1.3.1

## 1.3.0

### Minor Changes

- a21d1f5: 신청근무 접수에 근무팀·그룹별 하루 신청 인원 제한 설정을 추가합니다. 기존 접수 기간 설정을 유지하며, OFF를 기본 근무유형으로 표시하고 다른 근무유형도 추가할 수 있습니다.

### Patch Changes

- 34c29c3: AI 근무표 진입 버튼을 통합하고 사이드바 글자·대비와 해석 대기 상태를 개선합니다.
- 2ea9bb5: 근무 유형 설정에서 전각 시간과 일본어 약자를 지원하고, 일본어 변환 중 글자 잘림을 방지합니다. 이미 저장된 전각·반각 약자는 다른 항목을 수정할 때 그대로 유지합니다.
- 5e73238: 경고·확인 모달의 작은 경고 아이콘을 번들에 포함해 추가 이미지 요청을 없애고, 내용 해시가 포함된 정적 자산에 장기 브라우저 캐시를 적용합니다.
- a43ebcf: 개인별 월간 근무 횟수와 날짜·요일별 근무 제외를 설정할 수 있고, 새 횟수 조건은 필수로 적용합니다.
- 94248ac: 기존 근무유형 응답 형식을 지원해 신청근무 접수 화면 진입 오류를 수정합니다.
- e111377: 신청근무 접수설정 모달의 좌우 여백과 저장 버튼 정렬을 맞췄습니다.
- Updated dependencies [a21d1f5]
    - @dutying/api@1.3.0
    - @dutying/domain@1.3.0
    - @dutying/utils@1.3.0

## 1.2.5

### Patch Changes

- 7dd6c09: 개인별 월간 근무 횟수와 날짜·요일별 근무 제외를 설정할 수 있고, 새 횟수 조건은 필수로 적용합니다.
    - @dutying/api@1.2.5
    - @dutying/domain@1.2.5
    - @dutying/utils@1.2.5

## 1.2.4

### Patch Changes

- 확정한 전달 근무를 다음 달에 자동 연결하고 읽기 전용으로 보호합니다. 재확정 시 최신 전달 근무를 반영하면서 작성 중인 이번 달 근무와 고정값을 유지하며, 구 API 응답과 기존 저장 데이터의 호환성을 유지합니다.
- Updated dependencies
    - @dutying/domain@1.2.4
    - @dutying/api@1.2.4
    - @dutying/utils@1.2.4

## 1.2.3

### Patch Changes

- 44697f3: 경고·확인 모달의 작은 경고 아이콘을 번들에 포함해 추가 이미지 요청을 없애고, 내용 해시가 포함된 정적 자산에 장기 브라우저 캐시를 적용합니다.
    - @dutying/api@1.2.3
    - @dutying/domain@1.2.3
    - @dutying/utils@1.2.3

## 1.2.2

### Patch Changes

- 모든 교대제의 온보딩에 연차 근무유형을 필수로 설정합니다. 기존 임시 저장·업로드 자료에 연차를 안전하게 보충하고, 마지막 연차의 삭제·비활성화·분류 변경을 방지합니다.
    - @dutying/api@1.2.2
    - @dutying/domain@1.2.2
    - @dutying/utils@1.2.2

## 1.2.1

### Patch Changes

- 한국 서비스 지역에서만 병원명 자동완성을 표시하고, 해외에서는 병원명을 직접 입력하도록 변경합니다.
    - @dutying/api@1.2.1
    - @dutying/domain@1.2.1
    - @dutying/utils@1.2.1

## 1.2.0

### Minor Changes

- c0027c2: 랜딩 페이지를 사전 렌더링하고 다국어 모바일 이미지와 미리보기를 개선합니다. 근무표 생성·조정 흐름, 병동 설정, 프로필 및 간호사 관리 화면을 업데이트합니다.

### Patch Changes

- 5634787: 온보딩 제약 후보의 확인 상태와 원본 강도 권고를 서버에 전달해, 확인 전 안전 규칙이 HARD로 저장되지 않도록 개선합니다.
- Updated dependencies [5634787]
    - @dutying/api@1.2.0
    - @dutying/domain@1.2.0
    - @dutying/utils@1.2.0

## 1.1.0

### Minor Changes

- 5ea7f8f: 근무표 확인 및 편집을 위한 duty 페이지를 추가하고 관련 편집 흐름을 개선합니다.
- 29b9887: 센트리 추적 추가

### Patch Changes

- e276224: 문의하기가 웹에서 선택한 6개 언어를 채널톡에 전달하고 페이지 안에서 상담창을 열도록 개선합니다.
- 0df6cd5: 근무가 없는 칸에 남아 있던 고정 표시를 떼어 냅니다. 옛 버전을 불러온 뒤 자동완성이 그 달 전체를 실패하던 문제를 고칩니다.
- c3731f1: 자동완성 조절 칩을 dev·로컬에서 기본으로 켭니다. 운영 API 뒤에서는 그대로 감춰집니다.
- bc3dace: Apply the website language before opening Channel Talk for returning visitors.
    - @dutying/api@1.1.0
    - @dutying/domain@1.1.0
    - @dutying/utils@1.1.0
