# 의미 보존 전환 2차 구현·개발계 공개 계약

기준: 전체 재설계 §6~18 및 P1 PR #154/#60. 이번 요청은 develop 반영, 개발계 기능 활성화와 모니터링이다. 운영 공개는 포함하지 않는다.

## 실행 경로

- 새 대화 해석은 근거 구간·대상·날짜·강도와 artifact를 함께 저장한다. PREVIEW_READY라도 원문/범위/버전 검증과 잠긴 배치 충돌 검사에 실패하면 확인할 수 없다.
- 계획은 별도 불변 행에 저장한다. UTF-8 planJson의 SHA-256을 planHash로 사용한다. 확인 입력은 planHash와 expectedRevision만 받으며 raw items 편집을 거절한다. 새 확인 턴이 confirmation 역할을 하며 execute는 확인 ID, planHash, sourceVersionId와 멱등 키를 요구한다.
- 재해석은 전체 요청을 REPLACE/RESET한다. ADD/REMOVE로 조건을 조용히 합치지 않는다. 현재 지원 범위는 명시적 배정/금지 및 월 단위 횟수(EACH/GROUP_TOTAL, MIN/MAX/EXACT)다. 미지원은 v1 자유문장으로 실행하지 않는다.
- RULE은 기존 카탈로그·도메인 검증으로 변환하며 월 요청 테이블에 저장하지 않는다. HARD 배정 CELL은 날짜별 singleton MIN 1 조건으로 실행한다. SOFT 배정은 보류한다. 양 서버가 계획 범위와 컴파일 의미를 검증하고 원문 추가 실행은 금지한다.
- Spring은 저장된 원본 표에 patch를 합친 결과를 의도와 직접 비교한다. 누락/중복/알 수 없는 근무/잠긴 배치 변경/HARD 미충족은 적용 불가다. 기존 리비전·스냅샷·재시도 계약을 유지한다.

## 실패 추적

- 해석 차단, 실행 실패, 결과 검증 실패, 사용자 신고를 incident와 outbox에 같은 짧은 트랜잭션으로 저장한다. 원문·간호사 이름은 Slack에 싣지 않는다.
- 전송 worker는 DB lease를 커밋한 뒤 외부 호출한다. Slack ok/channel/ts를 ack로 저장하며 429 대기, 통신 오류 backoff, 설정 오류 BLOCKED_CONFIGURATION을 구분한다. lease 만료 후 제한적 재시도하며 exactly-once를 주장하지 않는다. incident ID로 중복을 식별한다.
- 어드민 세션으로 조회·분류·회귀 사례 ID 연결·차단 알림 재시도가 가능하다. 신고는 작성자/병동/대화 범위를 검증한다. 원본 고객 정보를 회귀 저장소에 자동 복사하지 않는다.

## 공개와 검증

- dev 프로필과 LLM 개발 배포 설정에 대화/semantic 실행/preview/outbox/조절을 명시적으로 켠다. dev 한정 조절 권한 공개는 병동 권한 검사를 유지한다. 다른 프로필 기본값은 닫힘이다.
- DB는 V61 Flyway 자동 적용으로만 변경한다. 실제 develop 최신 migration과 충돌 시 병합 전 재번호한다.
- 동일 계획 hash·raw items 변조·오래된 확인·중복 실행·고정 충돌·결과 조건 위반·outbox lease/ack/재시도 테스트 및 빌드/CI를 통과시킨다. 실제 모델 소수 smoke 결과와 결정적 테스트를 구분한다.
- 개발계의 실행 artifact 버전, 준비 상태, 기능 값, Flyway 이력·스키마와 알림 전달 상태를 확인한다. 스키마를 삭제하는 rollback은 하지 않고 신규 semantic 진입만 끈다. 저장된 작업의 읽기/최종화와 outbox는 유지한다.
- 실제 모델 이해 정확도·p95·비용을 측정한 holdout 평가와 전체 Flutter 전환은 별도 공개 기준이다. 이번 개발계 활성화를 운영 품질 보증으로 보고하지 않는다.
