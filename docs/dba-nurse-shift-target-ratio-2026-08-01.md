# DBA 전달 문서: 간호사별 근무 목표 비율 가중치 추가

## 배경

근무자별 가능 근무(D/E/N 등)가 같더라도 개인 사정이나 선호에 따라 배정 목표 비율이 달라질 수 있습니다. 예를 들어 D:E:N을 `7:7:7`로 두면 `1:1:1`, `14:7:7`로 두면 `2:1:1` 목표가 됩니다. 가능 근무가 D/E만인 근무자는 기본 `7:7`로 시작하고, 사용자가 `14:7`처럼 조정할 수 있습니다.

## DB 변경

대상 테이블: `nurse_shift_type`

추가 컬럼:

| 컬럼명 | 타입 | NULL | 기본값 | 제약 |
| --- | --- | --- | --- | --- |
| `target_ratio_weight` | `int` | `not null` | `7` | `1 <= value <= 99` |

적용 마이그레이션:

```sql
alter table nurse_shift_type
    add column target_ratio_weight int not null default 7;

alter table nurse_shift_type
    add constraint chk_nurse_shift_type_target_ratio_weight
        check (target_ratio_weight between 1 and 99);
```

프로젝트 반영 파일: `dutying-server/src/main/resources/db/migration/V76__nurse_shift_type_target_ratio_weight.sql`

## 데이터 정책

- 기존 row는 DB 기본값으로 모두 `7`이 채워집니다.
- 신규 row도 별도 값을 지정하지 않으면 `7`입니다.
- 비율은 가능 근무(`is_possible = true`)인 항목끼리만 해석합니다.
- 불가능 근무로 바꿔도 저장된 `target_ratio_weight`는 유지합니다. 나중에 다시 가능 근무로 켰을 때 이전 의도가 복원됩니다.

## API 영향

응답 DTO `NurseShiftTypeResDto`에 `targetRatioWeight`가 추가됩니다.

PATCH `/nurses/{nurseId}/shift-types/{nurseShiftTypeId}` 요청에 선택 필드 `targetRatioWeight`가 추가됩니다.

예시:

```json
{
  "isPossible": true,
  "targetRatioWeight": 14
}
```

## 운영 확인

1. Flyway migration `V76__nurse_shift_type_target_ratio_weight.sql` 적용 여부 확인
2. `nurse_shift_type.target_ratio_weight` 기본값이 `7`인지 확인
3. 기존 row의 `target_ratio_weight`가 null 없이 채워졌는지 확인
4. PATCH API로 `targetRatioWeight` 변경 후 조회 응답에 같은 값이 내려오는지 확인

## 롤백

기능 롤백이 필요하면 애플리케이션 배포를 먼저 이전 버전으로 되돌린 뒤 컬럼을 제거합니다.

```sql
alter table nurse_shift_type
    drop constraint chk_nurse_shift_type_target_ratio_weight;

alter table nurse_shift_type
    drop column target_ratio_weight;
```

DBMS에 따라 `drop check` 구문이 필요한 경우가 있으므로 운영 DB 문법에 맞춰 실행해 주세요.
