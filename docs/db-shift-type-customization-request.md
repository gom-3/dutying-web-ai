# DBA 요청: 신규 병동 근무유형 classification 컬럼 반영

## 1. 요청 범위

개발계에서 앞으로 새로 생성하는 병동과 근무유형만 대상으로 합니다.

- 기존 계정 고려 불필요
- 기존 병동·근무유형 데이터 보정 불필요
- 기존 근무유형 삭제·변경 불필요
- 운영 데이터 migration 및 backfill 불필요

새 병동을 만들 때 병원마다 근무명, 약자, 근무시간이 달라도 백엔드와 AI가 같은 의미로 이해할 수 있도록 `classification`을 함께 저장하는 것이 목적입니다.

## 2. 저장할 값

화면에 보이는 값과 내부 분류값을 분리해서 저장합니다.

| 컬럼 | 예시 | 용도 |
| --- | --- | --- |
| `name` | 주간 근무, 日勤, 데이 | 사용자에게 보여주는 근무명 |
| `short_name` | N, J, S, O | 화면과 근무표에 표시하는 약자 |
| `start_time` | 07:00 | 시작 시간 |
| `end_time` | 15:00 | 종료 시간 |
| `classification` | `DAY` | 근무의 표준 의미 |

예시:

| 병원에서 입력하는 값 | 저장할 `classification` |
| --- | --- |
| 日勤 / N / 07:00~15:00 | `DAY` |
| 準夜 / J / 15:00~23:00 | `EVENING` |
| 夜勤 / S / 23:00~07:00 | `NIGHT` |
| 休み / O | `OFF` |

## 3. DB 스키마 확인

개발 DB에서 아래 컬럼이 존재하는지 확인해 주세요.

```sql
SELECT
    table_name,
    column_name,
    column_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'ward_shift_type'
  AND column_name = 'classification';
```

현재 저장소의 초기 `ward_shift_type` 스키마에는 `classification`이 없으므로, 개발 DB에 없다면 migration을 추가해 주세요.

## 4. 신규 컬럼 추가

새로 생성되는 병동 근무유형에 반드시 분류값을 저장할 수 있도록 컬럼을 추가해 주세요.

```sql
ALTER TABLE ward_shift_type
    ADD COLUMN classification varchar(255) NOT NULL;
```

기존 데이터를 보존하거나 backfill할 필요가 없는 개발계이므로, 컬럼은 처음부터 `NOT NULL`로 생성해도 됩니다.

`account_shift_type.classification`은 기존 스키마에 존재하는지 함께 확인해 주세요. 없다면 신규 생성 흐름에서 필요한지 백엔드 DTO와 함께 확인 후 추가해 주세요.

## 5. 허용값

백엔드 enum과 동일하게 아래 값만 저장합니다.

```text
DAY
EVENING
NIGHT
OFF
OTHER_WORK
OTHER_LEAVE
```

기본 4개 근무는 다음 의미로 사용합니다.

```text
DAY      = 주간 근무
EVENING  = 저녁/이브닝 근무
NIGHT    = 야간 근무
OFF      = 휴무
```

## 6. 신규 생성 규칙

새 병동의 기본 근무유형은 아래 4개를 각각 하나씩 생성해야 합니다.

- `DAY` 1개
- `EVENING` 1개
- `NIGHT` 1개
- `OFF` 1개

병원별로 `name`, `short_name`, 시간, 색상은 다를 수 있지만 `classification`은 위 표준값으로 저장합니다.

예를 들어 다음과 같은 설정도 정상입니다.

```text
name = 日勤
short_name = N
classification = DAY
```

약자 `N`만 보고 야간으로 판단하면 안 되며, 항상 사용자가 선택한 `classification`을 저장해야 합니다.

## 7. 중복 점검

개발계에서 새 병동 생성 후 기본 4개 분류가 정확히 1개씩 생성되는지 확인해 주세요.

```sql
SELECT
    ward_id,
    classification,
    COUNT(*) AS active_count
FROM ward_shift_type
WHERE is_active = 1
  AND classification IN ('DAY', 'EVENING', 'NIGHT', 'OFF')
GROUP BY ward_id, classification;
```

각 신규 병동은 아래 결과가 되어야 합니다.

```text
DAY      = 1
EVENING  = 1
NIGHT    = 1
OFF      = 1
```

## 8. AI 연동 참고

AI에는 병원별 약자를 그대로 보내지 않고 백엔드가 `classification`을 기준으로 표준 코드로 변환합니다.

```text
DAY      → D
EVENING  → E
NIGHT    → N
OFF      → O
```

AI에 `DENO`라는 한 문자열을 보내는 것이 아니라, 각 근무유형을 `D`, `E`, `N`, `O` 중 하나로 전달합니다.

따라서 신규 병동 생성 시 `classification`이 반드시 저장되어야 합니다. 이 값이 없으면 병원별 약자(`N/J/S/O` 등)가 AI에 그대로 전달될 수 있습니다.

## 9. 완료 기준

- 개발 DB의 `ward_shift_type.classification` 컬럼이 존재함
- 신규 병동 생성 시 모든 근무유형에 `classification`이 저장됨
- 기본 `DAY`, `EVENING`, `NIGHT`, `OFF`가 각각 1개씩 생성됨
- 병원별 이름·약자·시간과 표준 분류가 분리되어 저장됨
- AI 요청 시 `classification` 기준으로 `D/E/N/O` 변환이 가능함
- 기존 계정·기존 병동 데이터는 이번 작업 범위에서 제외함
