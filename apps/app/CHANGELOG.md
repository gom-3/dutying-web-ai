# @dutying/app

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
