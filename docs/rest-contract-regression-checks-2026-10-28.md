# 휴무·충돌 설명·후보 반영 회귀 방지

월 휴무 계산 방식에 자동으로 정확한 상한을 붙이지 않는다. 명시적인 API exact와
개인별 HARD EXACT, 고정·신청 근무, 가능 근무, 행 순서, 수동 편집 보호는 그대로 유지한다.

## 자동 검사와 재발 검출 확인

단순히 현재 수정본이 통과하는 것뿐 아니라, 격리된 로컬 작업본에서 각 오류를 한 번씩
복원한 음성 대조를 실행했다. 테스트 실패가 환경 오류가 아닌 assertion 실패임을 확인했고,
각 변경은 finally에서 원복한 뒤 수정본의 동일 테스트를 다시 통과시켰다.
운영이나 개발 서버에 오류 코드를 배포하지 않았다.

| 복원한 오류 | 이를 검출하는 기존 회귀 테스트 |
| --- | --- |
| fixed 계산에 exact 상한 자동 추가 | `monthly-rest-requirement.test.ts`: uses fixed calculation as a minimum without inventing an exact upper bound |
| 화면이 공개 응답 대신 숨겨진 solver에서만 진단 조회 | `ai-execution-failure.test.ts`: shows consent proof from the public response without requiring hidden solver metadata |
| GENERATE 후보 선택에서 원래 fillPolicy 누락 | `ai-conversation-sidebar.test.tsx`: keeps the cached … candidate binding and applies once (ADJUST / EMPTY_ONLY / REBUILD_UNLOCKED) |
| Spring 실행 입력과 현재 버전의 동기화 누락 | `ScheduleConversationStoreTest`: candidateSelectionAdvancesOneVersionAcrossDifferentClickKeysAndKeepsQualitativeState (context 유지/변경) |

앞의 세 테스트는 Web PR CI의 Vitest에, 마지막 테스트는 Spring PR CI와 배포 빌드의
Gradle test에 포함된다. 별도의 중복 CI 작업을 추가하지 않는다. CI가 실행되지 않았거나
실패한 상태를 통과로 간주하지 않으며, 원격 실행 없이 로컬 통과만 확보했다면 구분해 보고한다.

## 빠른 로컬 검증

Web:

```sh
pnpm --dir apps/app exec vitest run \
  src/pages/make-shift/model/__tests__/monthly-rest-requirement.test.ts \
  src/pages/make-shift/model/__tests__/ai-execution-failure.test.ts
pnpm --dir apps/app exec vitest run \
  src/pages/make-shift/ui/steps/ai-auto-fill/__tests__/ai-conversation-sidebar.test.tsx \
  -t 'keeps the cached'
```

Spring (Java 17):

```sh
./gradlew test \
  --tests '*ScheduleConversationStoreTest.candidateSelectionAdvancesOneVersionAcrossDifferentClickKeysAndKeepsQualitativeState' \
  --tests '*AiEngineResultEvidenceDtoTest'
```

Engine의 월 경계·전달 야간 해석과 명시적 exact 우선순위는
`tests/unit/test_monthly_goals_and_night_boundary.py`에서 생성·검증 결과를 대조한다.
합성 월·임의 ID·사용자 지정 근무 코드를 포함하며 특정 병원이나 N15/max3 값을 목표로 고정하지 않는다.
Engine 개발/운영 배포의 기존 pytest 단계에서 실행된다.

## 실제 통합 검증과 남는 범위

개발계 화면에서 최초 입력과 후속 충돌 입력을 따로 복원하고 Engine → Spring → 작성 표의
APPLIED receipt까지 확인했다. 최초 입력의 알려진 전달근무는 33칸, 후속 입력은 44칸이다.
각각 실제 값을 대조하고, 결과의 고정·가능 근무·행 순서를 보존했다.
후속 최소 연속 야간14/최대3 충돌은 원인을 표시하고 명시적인 예외 동의를 거쳐 반영했다.

이 실제 통합 검증은 모든 PR에서 세 서비스를 함께 기동하는 자동 E2E 파이프라인과 다르다.
현재 보호는 각 저장소 자동 회귀 검사와 실제 개발계 통합 확인의 조합이다.
월·인원·새 규칙의 모든 조합에 대한 무결함 보장이나 운영 배포 완료를 뜻하지 않는다.
계약·직렬화·후보 선택을 다시 바꾸면 대응되는 자동 테스트와 실제 통합 경로를 함께 확인한다.
