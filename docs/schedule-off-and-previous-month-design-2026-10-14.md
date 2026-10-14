# 월 기본 휴무와 확정 전달근무 피드백 반영

## 확인된 문제
- 웹 휴무 체크의 목표(병동 weekly/fixed 정책, 공휴일, 월 보정, 개인 이월)가 생성 요청에서 빠져 엔진의 추정 오프 밴드와 달라진다.
- 웹에서 전달 확정본을 찾을 때 월별 shiftNurseId로 매칭한다. nurseId가 동일해도 월이 바뀌면 행 ID가 달라진다.
- 확정본을 읽는 서버도 저장 당시 행 ID만 사용해 재생성된 행에 근무가 누락될 수 있다.

## 최소 변경
- 웹의 기존 휴무 계산을 그대로 사용해 optional monthlyRestRequirement {minimumDaysByShiftNurseId, countedWardShiftTypeIds}를 생성/조절 요청에 전달한다. 설정 조회 실패를 무시하지 않는다. 정책이 비활성화이면 생략한다.
- Spring은 현재 달 행과 병동의 휴무 유형을 검증하고 엔진에 전달한다. 대화 실행 요청도 같은 필드를 사용하며 요청 원문/해시에 포함된다.
- 엔진은 집계 대상 유형으로 월 휴무 하한을 모델링하고 최종 결과를 다시 검사한다. 인력/고정근무와 충돌하면 부족한 결과를 성공으로 승인하지 않는다. 기본 9를 8로 낮추지 않는다. 추가 휴무 최소화는 기존 균형 목적함수에 맡긴다.
- 웹 전달근무는 nurseId로 확정본 행을 찾고, 캐시를 진입 시 갱신한다. 서버 스냅샷도 nurseId를 우선 사용하며 nurseId가 없는 구버전 셀만 행 ID로 매칭한다.
- 미입력 전달근무는 실제 휴무로 만들지 않으며 기존 고정/신청근무 보호와 행 순서를 유지한다.

## 검증 및 범위
- 11월 목표 9, 인원 제외 이후에도 전원 최소 9; 고정근무 충돌 시 실패; 커스텀 휴무 유형 집계; disabled 정책 호환.
- 10월 확정→11월 조회, 서로 다른 월 행 ID, 재생성 행, 연도 경계, 구버전 스냅샷.
- Flyway migration 없음. 데이터/운영 배포는 이번 작업 범위에 포함하지 않는다.

## 실제 계약
`AutofillReq.monthlyRestRequirement`와 대화 `ExecuteReq.monthlyRestRequirement`는 동일한 optional 객체다.

```json
{"minimumDaysByShiftNurseId":{"501":9,"502":10},"countedWardShiftTypeIds":[4]}
```

대화 실행은 원문 요청과 해시에 목표를 포함하고, 실제 엔진 요청 archive에도 기록한다. Spring은 해당 실행 결과의 현재 달 셀을 다시 집계해 HARD `MONTHLY_REST_MINIMUM`을 보고한다. 별도 개인/병동 설정 저장이나 스키마 추가는 없다.

## 배포 및 확인
- 배포 순서: LLM → Spring → 웹. 이전 클라이언트는 optional 값을 생략하므로 기존 동작을 유지한다.
- 운영 배포는 수행하지 않았다. 실제 피드백 병동 ID/원본 표는 제공되지 않아 운영 데이터 재현 대신 결정론적 fixture로 검증했다.
- Spring 관련 테스트 132개 통과, build -x test 통과. LLM 관련 테스트 115개 통과, ruff 통과. 웹 관련 테스트/타입/lint 확인.
