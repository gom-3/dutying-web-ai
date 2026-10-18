# @dutying/app

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
