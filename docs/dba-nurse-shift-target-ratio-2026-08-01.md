# DBA 전달 문서: 간호사별 근무 목표 비율 가중치 추가

## 배경

근무자별 가능 근무(D/E/N 등)가 같더라도 개인 사정이나 선호에 따라 배정 목표 비율이 달라질 수 있습니다. 예를 들어 D:E:N을 `7:7:7`로 두면 `1:1:1`, `14:7:7`로 두면 `2:1:1` 목표가 됩니다. 가능 근무가 D/E만인 근무자는 기본 `7:7`로 시작하고, 사용자가 `14:7`처럼 조정할 수 있습니다.

## DB 변경

대상 테이블: `nurse_shift_type`

추가 컬럼:

| 컬럼명 | 타입 | NULL | 기본값 | 제약 |
| --- | --- | --- | --- | --- |
| `target_ratio_weight` | `int` | `not null` | `7` | `1 <= value <= 99` |
| `is_target_ratio_custom` | `boolean` | `not null` | `false` | 사용자가 직접 입력한 값 여부 |

적용 마이그레이션:

```sql
alter table nurse_shift_type
    add column target_ratio_weight int not null default 7;

alter table nurse_shift_type
    add constraint chk_nurse_shift_type_target_ratio_weight
        check (target_ratio_weight between 1 and 99);

alter table nurse_shift_type
    add column is_target_ratio_custom boolean not null default false;
```

프로젝트 반영 파일:

- `target_ratio_weight`: `dutying-server/src/main/resources/db/migration/V76__nurse_shift_type_target_ratio_weight.sql`
- `is_target_ratio_custom`: `V76`이 이미 운영/개발 DB에 적용된 경우 후속 migration 예: `V77__nurse_shift_type_target_ratio_custom_flag.sql`

### 추가 플래그가 필요한 이유

`target_ratio_weight`만 있으면 `7`이라는 값이 "예전 기본값 7"인지 "사용자가 직접 입력한 7일"인지 구분할 수 없습니다. 예를 들어 D/E/N/O 조합에서 E 기본값은 `6일`이지만 사용자가 E를 `7일`로 올릴 수 있고, 나이트킵에서도 OFF를 `16일`로 직접 둘 수 있습니다. 이 값들은 다른 조합의 기본값과 숫자가 겹치기 때문에, 별도 플래그 없이 자동 기본값 보정 로직을 적용하면 사용자의 명시 입력이 다시 기본값으로 되돌아갈 수 있습니다.

권장 정책:

- `is_target_ratio_custom = false`: 과거 기본값 또는 자동 기본값으로 보고, D/E/N/O classification 조합에 따라 앱이 기본 비율을 계산할 수 있습니다.
- `is_target_ratio_custom = true`: 사용자가 직접 입력한 값으로 보고, 숫자가 기본값 후보와 같더라도 그대로 보존합니다.
- PATCH 요청에 `targetRatioWeight`가 포함되면 서버는 해당 row의 `is_target_ratio_custom`을 `true`로 설정하는 것을 권장합니다.
- 추후 "기본값으로 되돌리기" 기능을 만들 경우 별도 API 필드로 `isTargetRatioCustom=false`를 보낼 수 있게 열어두면 됩니다.

## 데이터 정책

- 기존 row는 DB 기본값으로 모두 `7`이 채워집니다.
- 신규 row도 별도 값을 지정하지 않으면 `7`입니다.
- 비율은 가능 근무(`is_possible = true`)인 항목끼리만 해석합니다.
- 불가능 근무로 바꿔도 저장된 `target_ratio_weight`는 유지합니다. 나중에 다시 가능 근무로 켰을 때 이전 의도가 복원됩니다.
- 기존 row의 `is_target_ratio_custom`은 `false`로 두어 과거 `7:7:7` 또는 나이트킵 `N 5 / OFF 16` 같은 legacy 기본값을 새 기본 정책으로 보정할 수 있게 합니다.
- 사용자가 월간 근무 비율 입력값을 저장한 row는 `is_target_ratio_custom=true`로 두어 `7일`, `16일`처럼 기본값 후보와 겹치는 숫자도 명시값으로 유지합니다.

## API 영향

응답 DTO `NurseShiftTypeResDto`에 `targetRatioWeight`가 추가됩니다.
가능하면 `isTargetRatioCustom`도 함께 내려주는 것을 권장합니다.

PATCH `/nurses/{nurseId}/shift-types/{nurseShiftTypeId}` 요청에 선택 필드 `targetRatioWeight`가 추가됩니다.
서버는 `targetRatioWeight`가 포함된 PATCH를 사용자의 명시 입력으로 보고 `isTargetRatioCustom=true`를 설정합니다.

예시:

```json
{
  "isPossible": true,
  "targetRatioWeight": 14,
  "isTargetRatioCustom": true
}
```

## 운영 확인

1. Flyway migration `V76__nurse_shift_type_target_ratio_weight.sql` 적용 여부 확인
2. `nurse_shift_type.target_ratio_weight` 기본값이 `7`인지 확인
3. `nurse_shift_type.is_target_ratio_custom` 기본값이 `false`인지 확인
4. 기존 row의 `target_ratio_weight`가 null 없이 채워졌는지 확인
5. PATCH API로 `targetRatioWeight` 변경 후 조회 응답에 같은 값이 내려오는지 확인
6. PATCH API로 `targetRatioWeight` 변경 후 해당 row의 `is_target_ratio_custom`이 `true`가 되는지 확인

## 롤백

기능 롤백이 필요하면 애플리케이션 배포를 먼저 이전 버전으로 되돌린 뒤 컬럼을 제거합니다.

```sql
alter table nurse_shift_type
    drop constraint chk_nurse_shift_type_target_ratio_weight;

alter table nurse_shift_type
    drop column is_target_ratio_custom;

alter table nurse_shift_type
    drop column target_ratio_weight;
```

DBMS에 따라 `drop check` 구문이 필요한 경우가 있으므로 운영 DB 문법에 맞춰 실행해 주세요.
