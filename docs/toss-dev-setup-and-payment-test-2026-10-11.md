# 토스 dev 설정 + 결제 검증 담당자 실행 문서

> 2026-10-18 상태: 원래 빌링 PR은 develop/main에 포함됐고 dev 서버 CI 배포가 성공했습니다. 최신 상태와 남은 작업은 [재점검 결과](toss-status-2026-10-18.md)를 우선 참고하세요. 아래 10월 11일 접속 오류/배포 대기 기록은 당시 상태입니다.

2026-10-11 작성 / 2026-10-18 재확인 · 대상: 서버/CI·CD 담당자, 결제 검증 담당자

**목표: dev에서 Plus 테스트 카드 등록·첫 결제·사용권 적용·중복 방지·해지·환불까지 확인한다.**
이 문서는 설정 작업(2번)과 실제 검증(3번)을 함께 인계한다. 읽거나 설정만 마쳤다고 완료 처리하지 말고 마지막 결과표를 채운다. 토스 심사 제출 및 LIVE 전환은 별도다.

## 1. 현재 반영 상태와 역할

서버와 프런트는 CI 통과 후 develop에 병합됐다. 이것은 실제 배포/PG 검증 완료를 의미하지 않는다.

| 대상 | 병합 정보 |
|---|---|
| 서버 `gom-3/dutying-server-ai` | PR #163, `5552ea7515633281f878034c24136430f0013f28` |
| 프런트 `gom-3/dutying-web-ai` | PR #56, `7b71eafff3b0057f6222a6c2341f72c0475e4250` |
| dev 웹 | https://dev.dutying.ai |
| dev API | https://dev.api.dutying.ai |

위 커밋을 포함한 최신 develop을 배포한다. 이후 커밋을 되돌리거나 위 커밋으로 강제 리셋하지 않는다. 기존 CI/CD를 이용하며 설정 변경 사항과 실제 배포 SHA를 기록한다.

| 담당 | 준비/실행 |
|---|---|
| 사용자/토스 계정 소유자 | 빌링 상점 접근 또는 테스트 키를 보안 경로로 제공, 테스트 이메일 수신 수단 제공, 이후 심사 자료 회신 |
| 서버/CI·CD 담당자 | 배포 SHA, TLS·라우팅, 서버 비밀 설정, TEST 환경, worker 상태 확인 |
| DBA | 기존 상용/정산 스키마·정책 확인. 초기 운영 직원이 없다면 서버 담당자와 초기 등록 협의 |
| 검증 담당자 | 가상 병동 OWNER로 아래 시나리오 실행, PG와 내부 원장 대조, 결과·캡처 기록 |
| 환불 작성자/승인자 | 서로 다른 운영 직원으로 환불 변경 작성/승인. 고객 OWNER 및 공용 관리자와 구분 |

한 명이 서버 설정과 검증을 함께 담당해도 된다. 환불 변경의 작성자와 승인자는 서버가 서로 다른 직원인지 검사한다.

## 2. 설정 전에 확인할 실제 제약

- 이전 점검에서 새 공개 페이지 3개는 404, dev API는 인증서 만료 오류였다. 현재도 같은지 재확인하고 먼저 해결한다. TLS 검증을 끄지 않는다.
- **현재 `/admin/operations/page`는 공용 관리 코드 기반 병동 요금·사용량 화면이다.** 여기에는 직원 로그인·환불 변경안·독립 승인 화면이 없다. 계약 수정 버튼도 실제 청구/수납 검증을 대신하지 않는다.
- 반면 `/internal/ops/**`에는 별도 직원 세션 및 변경안/승인 API가 있다. 따라서 이번 환불 검증은 서버 담당자가 API 클라이언트로 진행할 수 있다. 일반 운영자가 화면으로 환불을 처리하려면 별도 UI 연결 작업이 남아 있다.
- 오래된 운영 문서의 ‘관리 화면에서 직원 로그인·환불 승인 가능’ 설명을 현재 UI에 그대로 적용하지 않는다. 공용 관리자 세션만으로 `/internal/ops/**`에 접근할 수 있다고 가정하지 않는다.
- 직원 계정이 없다면 최초 등록은 별도 선행 작업이다. 서버 `scripts/operations/prepare-bootstrap.py` 및 `docs/operations-admin/DBA.md`의 입력 형식을 참고하되, 현재 등록 화면이 없으므로 생성된 링크만 전달하면 끝나는 상태는 아니다. 등록 API 절차는 아래 6절 참조. 기존 직원을 지우거나 중복 생성하지 않는다.

## 3. TEST 설정 순서

### A. 배포·공개 접속

1. 서버 자동 배포 성공과 실제 실행 SHA/readiness를 확인한다. 기존 dev 컨테이너는 `spring_ai_dev`다.
2. 프런트 배포 제공자에서 위 변경이 포함된 SHA·대상 도메인을 확인한다.
3. 아래 주소를 로그인 없는 브라우저에서 직접 열고 새로고침한다. 홈페이지로 잘못 이동하거나 로그인 화면으로 대체되면 실패다.
   - https://dev.dutying.ai/pricing
   - https://dev.dutying.ai/refund
   - https://dev.dutying.ai/subscription-terms
4. `https://dev.api.dutying.ai/readyz` 및 `/commercial/offer`에 인증서 경고 없이 접근되는지 확인한다. 결제 복귀 `/workspace/billing-return`의 직접 진입/새로고침도 SPA 라우팅이 처리해야 한다.

### B. 서버 설정

토스 실거래 신청 MID는 `bill_dutyic46q`. 테스트 키의 실제 소속 상점은 개발자센터에서 확인한다. 테스트 clientKey·secretKey·MID는 같은 상점 조합이어야 한다. dev DB·TEST 거래만 사용한다.

| 설정 | 값 |
|---|---|
| `COMMERCIAL_ENABLED` | `true` |
| `COMMERCIAL_CHECKOUT_ENABLED` | `true` |
| `COMMERCIAL_REVIEW_READY` | 처음 `false`, C단계 확인 후 `true` |
| `COMMERCIAL_PUBLIC_URL` | `https://dev.dutying.ai` |
| `COMMERCIAL_TERMS_VERSION` | `plus-monthly-2026-10-11` |
| `COMMERCIAL_PAYMENT_PROVIDER` | `TOSS` |
| `COMMERCIAL_RECURRING_ENABLED` | `true` |
| `TOSS_MERCHANT_ID` | 개발자센터에서 확인한 TEST 상점 값 |
| `TOSS_CLIENT_KEY` | 해당 상점의 테스트 클라이언트 키 |
| `TOSS_SECRET_KEY` | 해당 상점의 테스트 시크릿 키, 서버 비밀 저장소에만 등록 |

운영관리 설정은 아래 Spring 속성 기준이다. 현재 `application-common.yml`에 `OPS_ENABLED`, `OPS_ENVIRONMENT`, `OPS_FINANCIAL_TERMS_APPROVED`, `OPS_SECRET_KEY` 환경변수 매핑이 있다. env_file에는 이 환경변수 이름으로 설정하고 YAML을 그대로 붙이지 않는다.

```yaml
operations:
  enabled: true
  environment: TEST
  financial-terms-approved: true
  secret-key: <기존 암호화 키를 비밀 설정에서 주입>
```

`operations.secret-key`는 32바이트 키를 base64로 인코딩한 값이다. 기존 빌링키/OTP가 저장돼 있다면 동일 키를 유지해야 한다. 신규 환경에만 최초 생성하고 보관하며, 실제 값을 문서·PR·로그·프런트에 넣지 않는다.

현재 dev compose는 서버 `config/ai.env`를 env_file로 읽는다. GitHub Secret 등록만으로 컨테이너에 전달된다고 가정하지 않는다. 기존 배포는 호스트 설정 파일을 덮어쓰지 않으므로 실제 주입 경로를 확인한다. 설정 변경 후 기존 절차로 재기동/재배포한다.

프런트 빌드 설정:

```text
VITE_SERVER_URL=https://dev.api.dutying.ai
VITE_APP_PUBLIC_URL=https://dev.dutying.ai
```

프런트에 토스 secretKey를 넣지 않는다. `VITE_SELLER_*`로 기본 사업자 정보를 덮어쓰고 있다면 공개 정보가 올바른지도 확인한다.

### C. DB·상품 정책·개방

이번 토스 변경의 신규 DDL은 없다. 서버 `docs/toss-billing-dba-handoff-2026-10-11.md`의 읽기 전용 SQL로 기존 V55 복구를 포함한 선행 migration과 실제 테이블·활성 정책을 확인한다. 과거 migration 수동 재실행이나 임의 가격 UPDATE를 하지 않는다.

확인할 상품: **Plus 1병동, VAT 포함 월 19,900원, 기본 편성 50명, 추가 1명 990원, 관리자 총 10명, 주기당 전체 생성 30회/부분 조정 10회, 1회 청구 상한 100만원.**
Hospital은 개별 계약·계좌이체다. 추가 AI 팩·현장 세팅·중도 증원은 이번 빌링 전용 카드 판매 대상에서 제외한다. 이벤트 무료 이용은 카드 자동 전환으로 처리하지 않는다.

프런트 저장소에서:

```sh
python3 scripts/verify-toss-review.py
```

상품 정보·정책·TEST 설정을 확인한 뒤 `COMMERCIAL_REVIEW_READY=true`로 반영하고:

```sh
python3 scripts/verify-toss-review.py --require-ready
```

두 명령은 공개 URL GET 점검이다. HTML 응답/ready=true만으로 실제 화면·PG 키·DB·결제 성공을 입증하지 않는다. 다음 실거래 흐름을 TEST에서 검증해야 한다.

## 4. 테스트 계정 준비

- 심사 계정 관리 도구도 `/admin/review-accounts/page`에 추가됐다. 기존 관리자 로그인·정산 코드 인증이 필요하다. 실제 발급/로그인 성공은 별도 확인한다. 가상 데이터 계정이더라도 빌링 이메일 재인증 수신 수단이 없으면 결제 테스트에 사용할 수 없다.
- 고객용: dev에서 이메일/비밀번호로 일반 가입 → 가상 병동 생성 → 병동 OWNER 확인. 소셜 전용 계정은 심사용으로 사용하지 않는다.
- 결제 직전 이메일 재인증을 진행할 수 있도록 해당 메일함 수신을 확인한다. 토스 심사 시 코드 확인 방법도 담당자와 협의한다. 인증 우회 계정을 만들지 않는다.
- 실제 간호사 개인정보 대신 가상 편성 인원을 넣는다. 이미 실거래가 연결된 병동/고객은 사용하지 않는다.
- 병동 OWNER 결제 계정과 `/internal/ops` 직원 계정은 다르다. 환불 검증에는 권한이 있는 운영 직원 2명의 독립 세션을 준비한다.
- 비밀번호·OTP·세션 쿠키·초대 토큰·카드 정보는 아래 결과표와 캡처에 넣지 않는다.

## 5. 고객 화면과 정산 검증

| 순서 | 실행 | 통과 조건 / 남길 증빙 |
|---|---|---|
| 1 | 공개 가격·환불·약관 확인 | 실제 DB 정책과 일치, 사업자정보 표시, 월 구독/갱신/해지 안내 확인 |
| 2 | `/workspace`에서 OWNER 병동 선택 → `결제·증설` → Plus 견적 | 기본 19,900원. 51명 계약 견적은 20,890원. 승인한 인원·금액·기간·약관을 확인 |
| 3 | 정기결제/환불 동의와 이메일 재인증 → 토스 카드 등록 | TEST 키를 사용하는 토스 인증 화면. 성공 복귀만으로 Plus가 적용되지는 않음 |
| 4 | 복귀 화면 `첫 결제하고 구독 시작` | PG 승인 후 주문 APPLIED, 해당 scope Plus 적용, mandate ACTIVE 및 연결. 주문·청구서·승인 이벤트의 금액/통화/참조 일치 |
| 5 | 같은 주문 결과 새로고침/재조회 | PG 승인·청구·권한 지급이 중복되지 않음. 원래 주문 ID로 대조 |
| 6 | AI 생성/부분 조정 등 유료 기능과 사용량 확인 | 사용권과 제공량이 맞고, 성공/실패에 따른 횟수 처리가 설계와 일치. 전액 미사용 환불용 병동과 구분 |
| 7 | 결제 메뉴에서 다음 갱신 해지 예약 | cancelAtPeriodEnd 반영, 현재 이용기간 유지, 기간 종료 뒤 다음 자동 청구 없음. 해지와 즉시 환불은 별개 |
| 8 | 별도 미사용 테스트 구독에서 `환불·정산 문의`로 원 청구서 선택/접수 | 접수 ID와 createdAt 보존. 7일 이내 유료 기능 전체 미사용이면 전액 환불 기준 |
| 9 | 운영 직원의 환불 작성 → 다른 직원 승인 → worker 처리 | PG 취소 결과와 내부 환불/취소 이벤트를 대조. 승인 버튼/API 성공만으로 환불 완료라고 기록하지 않음 |
| 10 | 실패/불확실한 결제 결과 확인 | 확정 거절은 실패로 표시되고 Plus 미적용. 타임아웃/UNKNOWN은 결과 재조회·대조하며 새로운 결제로 반복 청구하지 않음 |
| 11 | 범위/권한/한도 확인 | 비OWNER, 다른 병동, 미인증 요청 차단. 100만원 초과 및 Hospital/추가 팩 카드 청구 차단. 한도는 서버 자동 테스트도 함께 확인 |
| 12 | 다음 주기 갱신·해지 후 미청구 검증 | TEST 전용 fixture/시계 제어가 가능한 테스트에서 worker 검증. 기존 고객의 날짜·원장 직접 UPDATE 금지. 실제 PG 갱신을 미실행했다면 미실행으로 기록 |

타임아웃/실패 재현이 실제 TEST PG에서 불가능하면 관련 자동 테스트 결과를 별도 기재한다. 자동 테스트 통과를 PG 실측 통과로 바꾸어 기록하지 않는다. 불확실한 결제 건은 주문 ID 기준 PG 조회·원장 대조부터 하고 DB 상태를 수동으로 APPLIED로 바꾸지 않는다.

취소와 정산의 범위: dev TEST에서는 실제 은행 입금/PG 수수료 정산이 발생했다고 간주하지 않는다. 승인·취소 금액과 내부 원장 일치는 확인하고, 실제 수수료/정산명세/입금 대조는 LIVE 전환 후 첫 정산 때 별도 검증한다.

## 6. 서버 담당자용 환불 API 검증 절차

현재 UI에 해당 메뉴가 없으므로 API 클라이언트를 사용한다. 클라이언트 파일/실행 로그를 공유할 때 비밀 값과 쿠키를 제거한다. 아래 API는 모두 dev API 기준이다.

1. 직원 A/B별로 독립 쿠키 저장소를 사용한다. `GET /internal/ops/session/csrf`의 token을 해당 세션의 모든 쓰기 요청에 `X-Ops-CSRF`로 보낸다.
2. 기존 직원은 `POST /internal/ops/session`에 `{email,password,otp}`로 로그인한다. 고객 JWT나 공용 관리 코드로 대체하지 않는다.
3. 초기 직원 등록이 필요한 경우, 승인된 초기 등록 절차로 발급한 token을 사용해 `POST /internal/ops/session/enroll`에 `{token,password,secret,otp}`를 보낸다. secret은 인증 앱과 공유하는 32자 Base32 OTP 비밀값, otp는 현재 6자리 코드다. 비밀번호는 12~72자다. CSRF/쿠키를 유지한다. 등록 도구는 DBA 검토 없이 임의 실행·적용하지 않는다.
4. `GET /internal/ops/me`, `/internal/ops/customers/{customerId}`, `/internal/ops/lists/invoices`, `/internal/ops/lists/refunds` 등으로 계정 권한·고객·원결제를 확인한다. 응답 자료에 민감한 값이 있으면 기록에서 제거한다.
5. 직원 A가 `POST /internal/ops/proposals`로 환불 초안을 작성한다. `Idempotency-Key`는 16~80자의 영숫자/밑줄/하이픈으로 만들며 동일 요청 재시도에는 동일 키를 사용한다.

```json
{
  "kind": "SUBSCRIPTION_REFUND",
  "target": "실제 customerId",
  "expectedVersion": 0,
  "reason": "TEST: 7일 이내 유료 기능 미사용 환불 검증",
  "payload": {
    "invoiceId": "원 청구서 ID",
    "paymentId": "원 APPROVAL 이벤트 ID",
    "gross": 19900,
    "policyEvidenceRef": "CUSTOMER_REQUEST:실제 접수 ID",
    "paidFeaturesUnused": true
  }
}
```

위 `expectedVersion: 0`과 금액은 형식 예시다. 실제 고객 최신 version과 원결제/환불 기준 금액으로 바꾼다. `paymentId`는 내부 승인 이벤트 ID이며 토스 paymentKey가 아니다. 미사용 여부는 AI뿐 아니라 유료 기능 전체를 확인한다.

6. `GET /internal/ops/proposals/{id}` 및 `/{id}/preview`로 영향 확인 → A가 `POST /internal/ops/proposals/{id}/submit` → B가 내용을 확인하고 `POST /internal/ops/proposals/{id}/approve`한다. 두 쓰기 요청 body는 `{expectedVersion,payloadHash,reason}`이다. **여기서는 고객 version이 아닌 변경안의 최신 version/hash**를 매번 다시 조회해서 사용한다. 자기 승인 차단/낡은 version 거절을 우회하지 않는다.
7. 승인 후에도 refund 상태, worker 결과, PG 취소 내역, 원결제 잔액을 확인한다. 주문/환불 API 재시도 때문에 취소 금액이 중복되면 실패다.

기타 환불: 7일 이내 미사용 전액 외에는 접수일부터 남은 기간을 일할 계산하고 월 구독 AI 사용분을 추가 공제하지 않는다. 온라인 접수는 저장된 createdAt 기준이다. EMAIL/PHONE 접수는 해당 증빙과 실제 UTC requestedAt을 기록한다. 상세 계산·payload는 기존 `toss-review-handoff-2026-10-11.md`를 따른다. 별도 구매 횟수는 별도 정책이며 이번 카드 테스트 상품에서 제외한다.

## 7. 완료 보고 — 아래를 채워 전달

```text
[토스 dev 설정/검증 결과]
담당자 / 확인일:
서버 실행 SHA / 배포 결과:
프런트 배포 SHA / 배포 결과:
TLS·공개 페이지·복귀 라우팅: PASS / FAIL
TEST 상점 일치·키 주입 확인: PASS / FAIL (키 값 금지)
기존 DB/활성 Plus 정책 확인: PASS / FAIL
공개 점검 스크립트: PASS / FAIL
고객 OWNER·메일 재인증: PASS / FAIL
첫 결제·Plus 적용·원장 대조: PASS / FAIL / 미실행
중복 재조회: PASS / FAIL / 미실행
해지 예약 / 다음 주기 미청구: 각각 PASS / FAIL / 미실행
환불 작성·다른 직원 승인·PG 취소 대조: PASS / FAIL / 미실행
실패·UNKNOWN 복구: PG 실측 결과 / 자동 테스트 결과 구분
갱신 결제: PG 실측 결과 / 자동 테스트 결과 구분
검증용 주문·청구서·환불 ID: (비밀 값 제외)
미해결 항목 / 추가 UI 필요 항목:
마스킹한 캡처 위치:
```

모든 설정 완료와 E2E 완료를 구분한다. 미실행/FAIL이 남으면 ‘전체 완료’로 보고하지 않는다. 실제 화면 캡처는 프런트 `docs/toss-billing-review-2026-10-11.html`에 삽입하고 저장한다. 인증 키·카드 정보·OTP·쿠키는 캡처하지 않는다.

이 단계 이후 사용자에게 넘길 것: 검증 결과, 심사용 고객 계정의 안전한 전달 방법, 캡처를 넣은 HTML. 사용자/계약 담당자는 PPT 변환과 토스 회신을 진행한다. dev URL 심사 허용 여부는 토스에 확인하며, 계약 승인 후 LIVE 키·운영 배포·첫 실정산 확인은 별도 작업이다.
