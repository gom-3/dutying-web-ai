# 앱 마이 연간 근무 통계 API 싱크

작성일: 2026-08-02  
대상: 앱 마이 탭 상단 근무 통계

## 서버 반영 상태

2026-08-02 기준으로 마이 탭 상단의 "올해 근무 며칠" 통계를 위한 서버 API가 반영되었습니다.

신규 API:

```http
GET /accounts/{accountId}/shifts/statistics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

예:

```http
GET /accounts/123/shifts/statistics?startDate=2026-01-01&endDate=2026-08-02
```

앱은 마이 탭 상단 통계에서 기존처럼 월별 `account_shift`를 전부 조회해 직접 합산하지 말고, 이 API 응답을 우선 사용하면 됩니다.

## 왜 바뀌었는가

기존 앱 계산은 올해 1월 1일부터 오늘까지 월별 근무표를 가져온 뒤 `accountShiftTypeId` 기준으로 합산했습니다.

병동 이동이 있으면 과거 병동의 `accountShiftTypeId`를 현재 병동의 근무유형 목록으로 해석할 수 있어, 근무/오프 분류나 색상/시간 계산이 틀어질 수 있었습니다.

이번 1차 서버 정책은 DB 스키마 변경 없이 아래 기준으로 안정화했습니다.

- 기준 데이터는 `account_shift`
- `accountShiftTypeId`가 아니라 근무 약자 `shortName` 기준으로 그룹핑
- 병동이 달라도 `shortName`이 같으면 같은 근무로 합산
- 총 근무일은 오프성 근무를 제외한 날짜 수
- 근무시간은 1차에서 정확도 보장이 어려워 `null`

## 응답 계약

```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-08-02",
  "workedDays": 123,
  "workedMinutes": null,
  "workedHours": null,
  "statisticsPolicy": "SHORT_NAME",
  "typeStats": [
    {
      "shortName": "D",
      "count": 42,
      "isWorked": true,
      "classification": "DAY",
      "color": "#4DC2AD"
    },
    {
      "shortName": "O",
      "count": 45,
      "isWorked": false,
      "classification": "OFF",
      "color": "#4D6385"
    }
  ]
}
```

필드 의미:

| 필드 | 의미 |
| --- | --- |
| `startDate` | 통계 시작일 |
| `endDate` | 통계 종료일 |
| `workedDays` | 근무로 판단된 날짜 수 |
| `workedMinutes` | 1차에서는 `null` |
| `workedHours` | 1차에서는 `null` |
| `statisticsPolicy` | 현재는 `SHORT_NAME` 고정 |
| `typeStats` | 근무 약자별 집계 |
| `typeStats[].shortName` | 정규화된 근무 약자 |
| `typeStats[].count` | 해당 약자의 근무 row 수 |
| `typeStats[].isWorked` | 근무일 포함 여부 |
| `typeStats[].classification` | 대표 근무 분류. 일부 데이터는 `null` 가능 |
| `typeStats[].color` | 대표 색상. 일부 데이터는 `null` 가능 |

## 서버 계산 정책

대상 row:

- `account_shift.account_id = accountId`
- `shift_date between startDate and endDate`
- `account_shift_type_id is not null`

근무유형이 없는 빈 날짜 row는 통계에서 제외됩니다.

`shortName` 정규화:

- 앞뒤 공백 제거
- 영문 uppercase
- `null` 또는 빈 값은 `UNKNOWN`으로 집계

근무/비근무 판단:

| 기준 | 근무로 판단 |
| --- | --- |
| `classification` 있음 | `DAY`, `EVENING`, `NIGHT`, `OTHER_WORK` |
| `classification` 있음 | `OFF`, `OTHER_LEAVE`는 비근무 |
| `classification` 없음 | `O`, `OFF`, `휴`, `휴가`, `연차`, `교육`은 비근무 |
| `classification` 없음 | 그 외 커스텀 약자는 근무 |

`workedDays`:

- 근무로 판단된 row의 `shiftDate` distinct count
- 같은 날짜 중복 row가 있어도 근무일은 1일로 계산

`typeStats[].count`:

- 약자별 row 수
- 같은 날짜 중복 row가 있으면 count에는 row 수대로 반영

정렬:

1. `D`
2. `E`
3. `N`
4. `O`
5. 그 외 근무 타입
6. 그 외 비근무 타입
7. `UNKNOWN`

같은 그룹 안에서는 `count desc`, `shortName asc` 순서입니다.

## 앱 반영 가이드

마이 탭 상단 통계 조회 기준:

```text
startDate = 올해 1월 1일
endDate = 오늘 날짜
```

예:

```http
GET /accounts/{accountId}/shifts/statistics?startDate=2026-01-01&endDate=2026-08-02
```

표시 권장:

- `workedDays`로 "2026년 N일 근무" 표시
- `typeStats`로 D/E/N/O/기타 약자별 분포 표시
- `workedHours == null`이면 "총 N시간 근무" 문구 숨김
- `color == null`인 항목은 앱 기본 색상 fallback 사용
- `classification == null`인 커스텀 근무는 `isWorked` 기준으로 표시

기존 월별 근무표 API는 캘린더/월별 근무표 표시에는 계속 사용합니다.

```http
GET /accounts/{accountId}/shifts?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

다만 마이 탭 상단의 연간 통계는 신규 statistics API를 우선 사용합니다.

## 기대 시나리오

### 개인근무 후 병동 연결

```text
2026-07: 병동 미연결, 개인근무 D 10개 / O 5개 입력
2026-08: B병동 연결, B병동 D 3개 / N 2개 수신
```

기대:

```text
D count = 13
N count = 2
O count = 5
workedDays = 15
```

### A병동에서 B병동 이동

```text
2026-07: A병동 D 10개 / E 5개 / O 3개
2026-08: B병동 D 4개 / N 6개 / O 2개
```

기대:

```text
D count = 14
E count = 5
N count = 6
O count = 5
workedDays = 25
```

### 병동별 타입 ID가 달라도 약자가 같은 경우

```text
2026-07 A병동 D: accountShiftTypeId=101
2026-08 B병동 D: accountShiftTypeId=205
```

기대:

```text
accountShiftTypeId가 달라도 shortName=D로 합산
```

### 커스텀 근무

```text
shortName=P
classification=null
```

기대:

```text
P count에 집계
isWorked=true
workedDays에 포함
```

### 근무유형 없는 날짜

```text
accountShiftTypeId=null
```

기대:

```text
통계에서 제외
```

## 앱 QA 체크리스트

- 마이 탭 진입 시 신규 statistics API를 호출하는가?
- 올해 1월 1일부터 오늘까지의 날짜 범위로 조회하는가?
- 병동 이동 후에도 같은 `shortName`이 하나로 합산되는가?
- `workedHours == null`일 때 총 근무시간 문구를 숨기는가?
- `classification == null`인 커스텀 근무를 `isWorked` 기준으로 표시하는가?
- `UNKNOWN` 항목이 내려와도 앱이 깨지지 않고 표시 또는 fallback 처리하는가?
- 기존 월별 근무표 캐시가 마이 상단 통계 값을 덮어쓰지 않는가?

## 한계와 후속

이번 1차 API는 DB 스키마 변경 없이 빠르게 안정화하는 목적입니다.

보장하는 것:

- 올해 `account_shift` 기준 근무일 수
- 병동이 달라도 같은 약자는 같은 근무로 합산
- 앱이 현재 병동 타입 ID만 보고 과거 근무를 잘못 해석하는 문제 제거

보장하지 않는 것:

- 과거 당시 병동 기준의 정확한 색상
- 과거 당시 병동 기준의 정확한 근무시간
- 같은 약자지만 병동마다 의미가 다른 근무의 구분
- 과거 근무의 출처 병동 표시

정밀 히스토리가 필요해지면 `account_shift`에 근무유형 스냅샷 필드 또는 출처 메타데이터를 추가하는 2차 개선이 필요합니다.
