# 비활성 근무유형 보관 지원 요청

## 배경

온보딩에서 전달 근무표를 업로드하면 근무표에 등장한 약어가 병동 근무유형으로 자동 생성됩니다.

예를 들어 전달 근무표에 `A`가 있으면 프론트는 `A` 근무유형을 생성하고, 간호사 초기근무에는 아래처럼 저장합니다.

```json
{
    "date": "2026-05-01",
    "shiftShortName": "A"
}
```

이후 사용자가 근무유형 단계에서 `A`를 삭제하는 경우가 있습니다. 이 삭제는 “과거 기록에서 A를 지우고 싶다”가 아니라 “앞으로는 A를 쓰지 않겠다”는 의미에 가깝습니다.

현재처럼 `A`를 완전히 삭제하면 초기근무 기록이 참조하는 `A`가 사라져 병동 생성 또는 초기근무 저장이 막힐 수 있습니다.

## 요청 요약

근무표/초기근무에서 이미 사용된 근무유형은 완전 삭제하지 않고 비활성 상태로 보관할 수 있게 해주세요.

- 과거 초기근무 기록에는 계속 참조 가능
- 앞으로의 근무표 작성, AI 생성, 간호사 가능근무 선택지에서는 제외
- 같은 약어를 나중에 다시 쓰려면 새로 생성하지 않고 기존 비활성 근무유형을 재활성화

## API 제안

### 병동 생성/온보딩 완료

`wardShiftTypes` 항목에 `isActive` 필드를 허용해 주세요.

```json
{
    "wardShiftTypes": [
        {
            "name": "A",
            "shortName": "A",
            "color": "#5A95F8",
            "startTime": null,
            "endTime": null,
            "isOff": false,
            "isDefault": false,
            "isCounted": true,
            "classification": "OTHER_WORK",
            "isActive": false
        }
    ],
    "shiftTeams": [
        {
            "name": "1팀",
            "nurses": [
                {
                    "name": "Nurse A",
                    "possibleShiftShortNames": ["D", "E", "N", "O"],
                    "initialShifts": [
                        {
                            "date": "2026-05-01",
                            "shiftShortName": "A"
                        }
                    ]
                }
            ]
        }
    ]
}
```

### 저장 규칙

- `isActive` 기본값은 `true`로 처리합니다.
- `isActive=false`인 근무유형도 `shortName` 유니크 제약에는 포함합니다.
- `initialShifts.shiftShortName`은 활성/비활성 근무유형 모두 참조할 수 있어야 합니다.
- `isActive=false`인 근무유형은 앞으로의 가능근무 기본값, 근무표 선택지, AI 생성 후보에서 제외합니다.
- 비활성 근무유형은 과거 스냅샷/초기근무 표시용으로 조회 가능해야 합니다.

### 시간값 처리

온보딩에서 자동 생성된 근무유형은 사용자가 삭제할 때 시간값을 입력하지 않았을 수 있습니다.

따라서 `isActive=false`인 근무유형은 `startTime=null`, `endTime=null`을 허용해 주세요.

활성 근무유형은 기존처럼 근무 유형이면 start/end time 필수, 휴무 유형이면 null 허용 정책을 유지하면 됩니다.

## 조회/사용 정책

### 병동 근무유형 조회

가능하면 응답에 `isActive`를 포함해 주세요.

```json
{
    "wardShiftTypeId": 123,
    "name": "A",
    "shortName": "A",
    "isActive": false
}
```

프론트는 기본 설정 화면/선택지에서는 `isActive=false`를 숨기고, 과거 근무표 렌더링에서는 표시용으로 사용합니다.

### 같은 약어 재사용

비활성 `A`가 있는 상태에서 사용자가 다시 `A`를 만들려고 하면 새 row를 만들지 않고 기존 `A`를 재활성화하는 것이 안전합니다.

백엔드에서도 동일하게 처리해 주세요.

- 같은 ward 안에서 `shortName=A`가 비활성으로 존재
- 새 근무유형 생성 요청이 `shortName=A`
- 새 row 생성 대신 기존 row를 `isActive=true`로 변경하거나 `409 SHIFT_TYPE_SHORT_NAME_ARCHIVED` 같은 명확한 에러 반환

프론트 UX는 “이전에 사용한 근무유형이에요. 다시 사용할까요?”로 처리할 예정입니다.

## 필요한 검증 케이스

1. `isActive=false` 근무유형이 있어도 온보딩 완료가 성공합니다.
2. `initialShifts`가 비활성 근무유형의 `shortName`을 참조해도 저장됩니다.
3. 간호사 `possibleShiftShortNames`에는 비활성 근무유형이 포함되지 않습니다.
4. 근무표/AI 생성 후보에는 비활성 근무유형이 포함되지 않습니다.
5. 과거 근무표 조회/렌더링에는 비활성 근무유형의 색상/이름/약어가 유지됩니다.
6. 같은 약어를 새로 생성하려는 경우 기존 비활성 근무유형 재활성화 또는 명확한 충돌 응답이 발생합니다.
