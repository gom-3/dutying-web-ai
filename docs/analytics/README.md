# Dutying growth analysis

역할별 사용법·연결 범위·검증 기준: [팀 가이드](team-guide.html). 이벤트 계약: [growth-events.schema.json](../contracts/growth-events.schema.json).

## 현재 상태

Google Analytics·Search Console 읽기 전용 인증과 실제 조회를 검증했다. 공식 계정은 gom3.official@gmail.com이다. 웹·앱 성공 이벤트 구현은 웹 PR #79, 앱 PR #27에 있다. develop 반영과 운영 배포는 다르며 새 이벤트는 배포 이후부터 수집된다. Meta 브라우저 조회는 가능하지만 API 연결은 미완료다. 예약 작업은 사용하지 않는다.

과거 .ai 웹 데이터는 속성 394593452에서 .ai hostname으로 분리한다. 새 웹 스트림 16150940090 / G-WT44BR53VN은 속성 551586530에 있다. 통합 도구는 구·신 속성의 웹·AI 앱 수집 상태를 별도로 반환한다. 기존 .net 모바일 사용자를 AI 앱 사용자로 해석하지 않는다.

## AI 직접 조회

Google 공식 Analytics MCP와 `growth_mcp.py`의 읽기 전용 도구를 사용한다. `query_dutying_growth(start_date,end_date)`는 현재/직전 기간의 웹 유입·성공 이벤트, 구/신 AI 앱 스트림, 확정 검색 집계를 구조화한다. 자세한 사용자 퍼널은 이벤트 수를 나누지 말고 GA 순차 퍼널 도구로 검증한다. 각 팀원은 자신의 계정 권한과 연결이 필요하다.

## 보조 화면 생성

승인된 인증 환경에서 프로젝트 루트 기준으로 실행한다. Python 기본 집계는 표준 라이브러리를 사용하며, 갱신 가능한 OAuth 인증에는 `scripts/analytics/requirements-mcp.txt`의 Google 인증 패키지가 필요하다.

```sh
# 조회 전 화면 확인
python3 scripts/analytics/report.py --preview
# 현재 과거 .ai 웹 집계: 새 스트림 배포·수신 이후 대상을 재확인
python3 scripts/analytics/report.py --property 394593452
# 검증
python3 -m unittest discover -s scripts/analytics -p 'test_*.py'
```

인증 우선순위: GA_ACCESS_TOKEN → GOOGLE_APPLICATION_CREDENTIALS 또는 이 컴퓨터의 승인된 전용 인증 파일 → gcloud ADC. 인증정보를 출력·공유·커밋하지 않는다. 인증이 없는 팀원에게 이 컴퓨터의 파일을 복사하지 않는다.

출력은 gitignore 대상인 `artifacts/analytics/index.html`, `report.json`이다. 보조 화면은 웹 GA 스냅샷이고 검색·앱·광고가 포함된 팀 공용 실시간 서비스가 아니다. 생성 시각을 확인한다. API 실패 시 기존 산출물을 덮어쓰지 않으며 파일은 소유자만 읽을 수 있게 저장한다. 코드 가이드 HTML은 내려받아 브라우저로 열 수 있다. 인증 없는 공개 서버에 실제 지표를 게시하지 않는다.

## 유지할 기준

- .ai hostname과 AI app streamId를 정확히 구분한다.
- 사용자를 일별·소스별로 합산하지 않는다. CTA 클릭은 설치·가입이 아니다.
- sign_up은 웹 비밀번호 가입만 보장한다. schedule_confirmed 횟수는 첫 활성화가 아니다.
- GA 주요 이벤트 등록은 sign_up/ward_created/schedule_confirmed이며 금전 기본값은 없다.
- 근거·가설·다음 실험을 구분하고 날짜·분모·시간대·임계값·샘플링·잘린 행을 표시한다.
- 광고비·결제·중복 제거 미검증 상태에서 CAC/ROAS·웹앱 통합 사용자를 확정하지 않는다.

공식 문서: https://developers.google.com/analytics/devguides/MCP · https://developers.google.com/analytics/devguides/collection/ga4/reference/recommended-events · https://firebase.google.com/docs/analytics/flutter/events
