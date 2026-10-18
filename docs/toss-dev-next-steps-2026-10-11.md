# 토스 심사: dev 배포부터 남은 작업

> 2026-10-18 상태: 원래 빌링 PR은 develop/main에 포함됐고 dev 서버 CI 배포가 성공했습니다. 최신 상태와 남은 작업은 [재점검 결과](toss-status-2026-10-18.md)를 우선 참고하세요. 아래 10월 11일 접속 오류/배포 대기 기록은 당시 상태입니다.

설정(2번)과 결제 검증(3번)을 함께 맡길 때는 [통합 실행 문서](toss-dev-setup-and-payment-test-2026-10-11.md)를 전달하세요.

## 사용자님이 할 일

1. 아래 두 PR은 2026-10-11에 **develop 병합 완료**했습니다. 담당자는 실제 dev 배포 SHA와 정상 응답을 확인합니다. 현재는 후속 릴리스를 통해 main에도 포함됐습니다. 운영 결제 개방/검증을 의미하지는 않습니다.
   - 서버: https://github.com/gom-3/dutying-server-ai/pull/163
   - 프런트: https://github.com/gom-3/dutying-web-ai/pull/56
   - 두 저장소 모두 `codex/toss-billing-review-20261011` 브랜치입니다.
2. 토스 개발자센터에 로그인해 **신청한 빌링 상점의 테스트 키를 확인**하고, CI/CD 담당자가 서버 비밀 설정에 등록하도록 전달합니다. 채팅·Git·프런트에는 secretKey를 넣지 않습니다. 실제 신청 MID는 `bill_dutyic46q`이며 테스트 키가 속한 상점도 확인해야 합니다.
3. 심사용 이메일/비밀번호 계정과 이메일 인증코드를 확인할 수단을 준비합니다. 실제 간호사 개인정보 없이 일반 가입 → 가상 병동 생성 → OWNER로 준비합니다. 소셜 전용 계정이나 인증 우회는 사용하지 않습니다.
4. 테스트/자료 완성 후 토스에 심사 자료를 회신합니다. dev URL 허용 여부도 담당자에게 확인합니다. HTML→PPT 변환은 기존 요청대로 사용자님이 진행합니다.

배포 완료와 공개 dev 접속 가능 여부를 알려주시면, 접근 가능한 범위에서 화면 확인·테스트 진행·심사 캡처 보완을 이어갈 수 있습니다. 현재 문서는 결제 테스트 성공을 의미하지 않습니다.

## CI/CD 담당자에게 그대로 전달

> 토스 심사 준비 PR 두 개는 develop에 병합했습니다. 실제 dev 배포와 설정·검증을 확인해주세요. CI/CD 구조 변경은 필요 여부를 판단해주세요. 서버의 토스 빌링 TEST 설정과 기존 운영관리 암호화 키 설정이 애플리케이션에 실제로 전달되어야 합니다. 키 값은 Git/로그에 남기지 말아 주세요. 설정 상세는 `docs/toss-review-handoff-2026-10-11.md`의 YAML을 봐주세요. 최초에는 review-ready=false로 배포하고, 상품 정책·공개 정보·테스트 환경 확인 후 true로 열어주세요. 공개 심사 URL은 외부에서 접속 가능해야 합니다.

설정 확인표:

| 범위 | 설정 |
|---|---|
| 서버 상품 기능 | `COMMERCIAL_ENABLED=true`, `COMMERCIAL_CHECKOUT_ENABLED=true` |
| 심사 개방 | `COMMERCIAL_REVIEW_READY=false`로 시작, 준비 확인 후 true |
| 기준 URL/약관 | `COMMERCIAL_PUBLIC_URL=https://dev.dutying.ai`, `COMMERCIAL_TERMS_VERSION=plus-monthly-2026-10-11` |
| PG | `COMMERCIAL_PAYMENT_PROVIDER=TOSS`, `COMMERCIAL_RECURRING_ENABLED=true` |
| 서버 전용 비밀 설정 | `TOSS_MERCHANT_ID`, `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`에 동일 TEST 상점 값 |
| 운영관리 | `operations.enabled=true`, `operations.environment=TEST`, `operations.financial-terms-approved=true`, `operations.secret-key`는 기존 암호화 키 유지. 상세 YAML 참조 |
| 프런트 빌드 | `VITE_SERVER_URL=https://dev.api.dutying.ai`, `VITE_APP_PUBLIC_URL=https://dev.dutying.ai` |
| DBA | 서버의 `docs/toss-billing-dba-handoff-2026-10-11.md` 기준 선행 스키마와 활성 Plus 정책 확인. 이번 변경의 신규 DDL 없음 |

현재 저장소 `docker-compose.dev.yml`은 서버 `config/ai.env`를 env_file로 사용합니다. 그 파일의 실제 내용은 확인하지 않았습니다. GitHub에 변수를 등록하는 것만으로 컨테이너에 전달된다고 가정하지 말고 담당자가 실제 배포 경로를 확인해야 합니다. CI/CD·원격 설정은 이번 작업에서 변경하지 않았습니다.

## CI/CD 담당자가 함께 확인할 접속 문제

추가 공개 점검에서 웹 3개 경로는 404, API는 TLS 인증서 만료 오류가 발생했습니다. 프런트 경로 배포/SPA 라우팅과 dev.api.dutying.ai 인증서 갱신·프록시 적용 상태를 확인해주세요. 인증서 검증을 끄는 방식으로 통과시키지 않습니다.

## 배포 뒤 자동 점검

프런트 저장소에서 Python 3만 있으면 실행할 수 있습니다. 인증정보 없이 공개 URL에 GET만 보냅니다.

```sh
python3 scripts/verify-toss-review.py
# 심사 개방 후에는 ready=true도 필수로 검사
python3 scripts/verify-toss-review.py --require-ready
```

- 공개 3개 페이지 응답 및 Plus 19,900원/50명/추가 990원, 전체 30회/부분 10회, 관리자 10명, 100만원 상한, 약관 버전을 검사합니다.
- 정책을 의도적으로 변경하면 스크립트의 EXPECTED도 함께 검토해야 합니다.
- HTML 응답만으로 화면 내용·배포 커밋은 입증되지 않습니다. 실제 브라우저 표시와 배포 커밋은 별도 확인합니다.
- 공개 API의 ready=true만으로 토스 키·DB·결제가 정상이라는 의미는 아닙니다.

## 배포/키 설정 후 실제 검증할 것

테스트 상점에서 카드 등록 → 첫 결제 → Plus 적용과 청구/승인 원장 일치 → 재확인 시 중복 청구 없음 → 해지 → 환불 접수/승인/PG 취소 대조 → 실패/미확정 재조회 순으로 확인합니다. 이후 카드 정보·키·개인정보가 없는 실제 화면으로 `docs/toss-billing-review-2026-10-11.html`의 캡처 칸을 채웁니다. 토스가 보낸 PPT 예시와 최종 구성 대조도 남아 있습니다.

## 2026-10-11 확인 한계

초기 요청에서는 dev 웹이 HTTP 403을 반환했습니다. 추가 점검 도구 실행에서는 상품/환불/정기결제 안내 URL 모두 HTTP 404였고, API는 TLS 인증서 만료로 검증에 실패했습니다. 요청 환경에 따라 응답이 달라졌으므로 화면은 별도 확인해야 합니다. SSH `dutying-dev-server`는 이름을 찾지 못했습니다. 접근 제한 또는 네트워크 문제일 수 있으므로 이것만으로 미배포를 단정하지 않습니다. dev DB, 실제 PG 거래, 심사 계정은 검증하지 않았습니다.
