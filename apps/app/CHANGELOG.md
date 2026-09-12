# @dutying/app

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
