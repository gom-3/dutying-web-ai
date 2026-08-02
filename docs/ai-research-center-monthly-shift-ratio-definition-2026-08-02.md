# AI 리서치 센터 전달 문서: 월간 근무 비율 기능 정의

작성일: 2026-08-02

## 목적

월간 근무 비율은 간호사별로 D/E/N/O 근무를 한 달에 어떤 비중으로 배정하고 싶은지 표현하는 개인화 목표값입니다. 같은 가능 근무 조합을 가진 간호사라도 개인 사정, 선호, 숙련도, 나이트 전담 여부 등에 따라 원하는 배정 비율이 다를 수 있으므로, AI 근무표 생성 과정에서 이를 soft preference로 활용합니다.

이 기능의 핵심은 "이 간호사는 이번 달에 어떤 근무 종류를 상대적으로 더 많이 또는 더 적게 배정받아야 하는가"를 AI가 알 수 있게 하는 것입니다.

## 사용자 문제

기존 가능 근무 설정은 특정 간호사가 어떤 근무를 할 수 있는지만 표현합니다.

예를 들어 두 간호사가 모두 D/E/N 가능이라면 기존 데이터만으로는 두 사람 모두 같은 비율로 배정해도 되는지, 한 사람은 D를 더 많이 받아야 하는지, 다른 사람은 N을 줄여야 하는지 알 수 없습니다.

월간 근무 비율은 이 공백을 채웁니다.

- D/E/N 가능 근무자 기본값이 `7:7:7`이면 `1:1:1` 의도입니다.
- 사용자가 `14:7:7`로 바꾸면 D를 E, N보다 약 2배 더 선호한다는 뜻입니다.
- N/O만 가능한 나이트킵은 기본값을 `15:15`로 두어 Night와 OFF를 반반 목표로 봅니다.
- 어떤 간호사가 E를 선호하면 E의 목표 일수를 더 높게 설정할 수 있습니다.

## 용어 정의

| 용어 | 의미 |
| --- | --- |
| 가능 근무 | 해당 간호사가 배정될 수 있는 ward shift type입니다. `isPossible=true`인 항목만 월간 비율 계산에 포함합니다. |
| Classification | 근무 타입의 표준 분류입니다. 월간 근무 비율은 `DAY`, `EVENING`, `NIGHT`, `OFF`만 대상으로 합니다. |
| D/E/N/O | 각각 `DAY`, `EVENING`, `NIGHT`, `OFF` classification의 화면 표시 코드입니다. |
| 목표 일수 | 사용자가 입력하는 숫자입니다. UI에서는 `9일`, `6일`처럼 보이지만 AI에서는 절대 보장 일수라기보다 비율 가중치로 우선 해석합니다. |
| 목표 비율 | 같은 간호사의 가능 D/E/N/O 목표 일수 합계 대비 각 항목이 차지하는 비율입니다. |
| 수동 입력값 | 사용자가 직접 수정한 목표 일수입니다. 기본값 후보와 숫자가 같더라도 사용자의 의도를 보존해야 합니다. |

## UI 동작 정의

위치: 근무자 관리 탭의 간호사 상세 바텀시트

섹션명: `월간 근무 비율`

기본 상태:

- 기본으로 닫혀 있습니다.
- 펼치기 아이콘을 누르면 편집 영역이 열립니다.
- 요약 영역에는 색 점, 근무 코드, 목표 일수, 퍼센트가 표시됩니다.
- 비율바는 항상 요약 아래에 표시되어 전체 분포를 시각화합니다.

표시 예:

```text
● D 9일(30%)   ● E 6일(20%)   ● N 5일(17%)   ● / 10일(33%)
[비율바]
```

편집 영역 예:

```text
D    E    N    /
9일  6일  5일  10일
```

표시 대상:

- `wardShiftType.classification`이 `DAY`, `EVENING`, `NIGHT`, `OFF`인 항목만 표시합니다.
- `OTHER_WORK`, 교육, 온콜, 특수근무 등 다른 classification은 이 섹션에 표시하지 않습니다.
- 가능 근무로 체크된 D/E/N/O만 월간 근무 비율에 표시하고 계산합니다.

## 기본값 정책

기본값은 병동의 활성 ward shift type 중 가능 근무로 켜진 D/E/N/O classification 조합을 기준으로 계산합니다.

| 가능 Classification | 기본 목표 일수 |
| --- | --- |
| D/E/N/O | D 9, E 6, N 5, O 10 |
| D/E/N | D 9, E 6, N 5 |
| D/E/O | D 11, E 10, O 9 |
| D/N/O | D 15, N 5, O 10 |
| E/N/O | E 15, N 5, O 10 |
| D/E | D 11, E 10 |
| D/N | D 15, N 5 |
| E/N | E 15, N 5 |
| D/O | D 21, O 9 |
| E/O | E 21, O 9 |
| N/O | N 15, O 15 |
| D | D 21 |
| E | E 21 |
| N | N 14 |
| O | O 30 |

주의:

- `O`는 화면에서 `/`로 표시될 수 있습니다.
- N/O만 가능한 나이트킵은 `N 15일`, `OFF 15일`을 기본값으로 사용합니다.
- 기존 DB row에 모두 `7`이 저장되어 있는 경우는 과거 neutral default로 보고 현재 조합 기본값으로 보정할 수 있습니다.
- 단, 사용자가 직접 입력한 값은 `7`, `15`, `16`처럼 기본값 후보와 겹쳐도 보존해야 합니다.

## AI 해석 기준

AI는 월간 근무 비율을 hard constraint가 아니라 soft preference로 사용합니다.

우선순위:

1. 법적/운영상 반드시 지켜야 하는 hard constraint
2. 고정 셀, 신청 근무, 관리자가 확정한 셀
3. 일자별 필요 인원과 근무 커버리지
4. 연속 근무, 휴식, 나이트 후 휴식 등 기본 품질 규칙
5. 간호사별 월간 근무 비율
6. 그 외 선호/공정성/분산 최적화

즉, 월간 근무 비율은 "가능하면 맞추는 목표"이며, 인력 커버리지나 필수 제약을 깨면서까지 맞추면 안 됩니다.

## 계산 방식

AI는 각 간호사별로 가능 D/E/N/O 항목을 모아 목표 비율을 계산합니다.

```text
targetPercent(classification) = targetRatioWeight / sum(targetRatioWeight of possible D/E/N/O)
```

예시:

```text
D 9일, E 6일, N 5일, O 10일
합계 = 30

D = 30.0%
E = 20.0%
N = 16.7%
O = 33.3%
```

AI가 월 단위 목표 count가 필요하면 아래처럼 변환할 수 있습니다.

```text
targetCount = targetAssignableSlotsForNurse * targetPercent
```

`targetAssignableSlotsForNurse`는 AI 설계에 따라 다음 중 하나로 둘 수 있습니다.

- 전체 월 일수
- 해당 간호사의 비고정/미배정 셀 수
- 고정 셀과 신청 근무를 반영한 후 남은 조정 가능 셀 수

권장 방식:

- 최종 스케줄 평가에서는 전체 월 일수를 기준으로 실제 D/E/N/O 분포를 평가합니다.
- 생성/repair 과정에서는 이미 고정된 셀과 신청 근무를 먼저 반영한 뒤 남은 셀에서 부족한 classification을 보정합니다.

## AI 최적화에서의 사용 예

AI는 각 간호사별 실제 배정 비율과 목표 비율의 차이를 penalty로 계산할 수 있습니다.

```text
ratioPenalty = sum(abs(actualPercent - targetPercent) * weightByClassification)
```

또는 목표 일수 기반으로 계산할 수 있습니다.

```text
countPenalty = sum(abs(actualCount - targetCount) * weightByClassification)
```

권장:

- N은 피로도 영향이 크므로 DAY/EVENING보다 penalty 가중치를 높게 둘 수 있습니다.
- OFF는 휴식/법적 제약과 겹치므로 hard rest rule을 먼저 적용하고, 월간 비율은 보조 점수로 씁니다.
- 나이트킵 N/O 조합은 `N 15 / O 15` 근처를 유지하되, 나이트 연속성 및 회복일 규칙을 반드시 함께 봐야 합니다.

## 요청 데이터 예시

AI 리서치 센터가 사용할 수 있는 최소 입력 구조 예시는 다음과 같습니다.

```json
{
  "nurseId": 101,
  "name": "김간호",
  "shiftRatioTargets": [
    {
      "wardShiftTypeId": 1,
      "classification": "DAY",
      "code": "D",
      "isPossible": true,
      "targetRatioWeight": 9,
      "targetPercent": 0.3,
      "isTargetRatioCustom": false
    },
    {
      "wardShiftTypeId": 2,
      "classification": "EVENING",
      "code": "E",
      "isPossible": true,
      "targetRatioWeight": 6,
      "targetPercent": 0.2,
      "isTargetRatioCustom": false
    },
    {
      "wardShiftTypeId": 3,
      "classification": "NIGHT",
      "code": "N",
      "isPossible": true,
      "targetRatioWeight": 5,
      "targetPercent": 0.1667,
      "isTargetRatioCustom": false
    },
    {
      "wardShiftTypeId": 4,
      "classification": "OFF",
      "code": "/",
      "isPossible": true,
      "targetRatioWeight": 10,
      "targetPercent": 0.3333,
      "isTargetRatioCustom": false
    }
  ]
}
```

## 저장/동기화 정책

현재 핵심 저장값:

- `nurse_shift_type.target_ratio_weight`

장기 권장 저장값:

- `nurse_shift_type.target_ratio_weight`
- `nurse_shift_type.is_target_ratio_custom`

`is_target_ratio_custom`이 필요한 이유는 기본값 후보와 사용자의 직접 입력값이 숫자만으로 구분되지 않기 때문입니다.

예:

- D/E/N/O에서 E 기본값은 `6일`입니다.
- 사용자가 E를 `7일`로 직접 올릴 수 있습니다.
- 그런데 `7`은 과거 neutral default이기도 합니다.
- 별도 플래그가 없으면 AI나 앱이 이를 자동 기본값으로 오해해 다시 `6일`로 보정할 수 있습니다.

권장:

- 사용자가 월간 근무 비율 입력값을 저장하면 `is_target_ratio_custom=true`로 저장합니다.
- 사용자가 기본값으로 되돌리기를 수행하면 `is_target_ratio_custom=false`로 저장합니다.
- AI 입력 데이터에는 가능하면 `isTargetRatioCustom`을 포함합니다.

## 예외 및 주의사항

- 가능 근무가 아닌 classification은 목표 비율 계산에서 제외합니다.
- D/E/N/O 외 classification은 이 기능의 대상이 아닙니다.
- 비율값은 소수 반올림 때문에 UI 합계가 100%가 아닐 수 있습니다.
- 목표 일수 합이 실제 월 일수와 다를 수 있습니다. 이 경우 AI는 숫자 자체보다 normalized ratio를 우선합니다.
- 사용자가 직접 입력한 값은 기본값 후보와 같더라도 보존합니다.
- OFF 비율은 최소 휴무, 연차, 공휴일, 법정 휴식 정책과 충돌할 수 있으므로 hard rest policy를 우선합니다.
- 특정 월의 공휴일, 병동 인력 부족, 신청 근무 과다, 고정 셀 과다 상황에서는 목표 비율을 완전히 맞추지 못할 수 있습니다.

## 성공 기준

AI 결과는 다음 기준을 만족해야 합니다.

- 가능 근무가 아닌 D/E/N/O를 새로 배정하지 않습니다.
- hard constraint와 고정/신청 근무를 훼손하지 않습니다.
- 간호사별 실제 월간 D/E/N/O 분포가 목표 비율에 가까워집니다.
- 목표 비율을 맞추지 못한 경우, 어떤 제약 때문에 못 맞췄는지 설명 가능해야 합니다.
- 나이트킵 N/O 조합은 기본적으로 Night와 OFF가 반반에 가깝게 나옵니다.

## 관련 프론트 구현

- `apps/app/src/pages/member/ui/nurse-detail-panel.tsx`
- `apps/app/src/pages/member/model/nurse-shift-types.ts`
- `apps/app/src/pages/member/model/__tests__/nurse-edit.test.ts`

## 관련 DBA 문서

- `docs/dba-nurse-shift-target-ratio-2026-08-01.md`
