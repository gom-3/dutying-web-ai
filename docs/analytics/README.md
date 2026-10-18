# Dutying growth analysis

역할별 사용법·연결 범위·검증 기준: [팀 가이드](team-guide.html). 이벤트 계약: [growth-events.schema.json](../contracts/growth-events.schema.json).

## 현재 상태

Google Analytics·Search Console 읽기 전용 인증과 실제 조회를 검증했다. 공식 계정은 gom3.official@gmail.com이다. 웹·앱 성공 이벤트 구현은 웹 PR #79, 앱 PR #27에 있다. develop 반영과 운영 배포는 다르며 새 이벤트는 배포 이후부터 수집된다. Meta 브라우저 조회는 가능하지만 API 연결은 미완료다. 예약 작업은 사용하지 않는다.

과거 .ai 웹 데이터는 속성 394593452에서 .ai hostname으로 분리한다. 새 웹 스트림 16150940090 / G-WT44BR53VN은 속성 551586530에 있다. 통합 도구는 구·신 속성의 웹·AI 앱 수집 상태를 별도로 반환한다. 기존 .net 모바일 사용자를 AI 앱 사용자로 해석하지 않는다.

## AI 직접 조회

Google 공식 Analytics MCP와 `growth_mcp.py`의 읽기 전용 도구를 사용한다. `query_dutying_growth(start_date,end_date)`는 현재/직전 기간의 웹 유입·성공 이벤트, 구/신 AI 앱 스트림, 확정 검색 집계를 구조화한다. 자세한 사용자 퍼널은 이벤트 수를 나누지 말고 GA 순차 퍼널 도구로 검증한다. 각 팀원은 자신의 계정 권한과 연결이 필요하다.

## 1년·월별·서비스별 분석 화면

저장소 루트에서 승인된 Google 인증 환경으로 실행한다. Python 환경에는 `scripts/analytics/requirements-mcp.txt`의 패키지가 필요하다.

```sh
# 최대 365일과 월별, 직전 동일 일수 비교를 원본 API에서 수집
python3 scripts/analytics/explorer.py
# 이 컴퓨터에서만 여는 읽기 전용 분석 서버
python3 scripts/analytics/serve.py --port 8795
# http://127.0.0.1:8795/
python3 -m unittest discover -s scripts/analytics -p 'test_*.py'
```

화면은 최근 30/90/180/365일 및 조회 구간의 달력 월을 선택한다. 현재 월과 첫 월은 부분 기간일 수 있다. 서비스·기기별로 기간 전체 수치를 직접 조회하며, 전체 사용자/방문을 월별·기기별 합산으로 재구성하지 않는다. 운영체제·유입 경로·성공 행동과 관측된 이벤트 목록, 소스별 첫/마지막 기록을 함께 표시한다. 규칙 기반 관찰과 원인 가설을 구분한다. 검색어 표와 월별 추세는 최근 1년 기준이며 별도 표기로 기간 필터 범위를 명시한다.

인증 우선순위: GA_ACCESS_TOKEN → GOOGLE_APPLICATION_CREDENTIALS 또는 이 컴퓨터의 승인된 전용 인증 파일 → gcloud ADC. 인증정보를 출력·공유·커밋하지 않는다. 다른 팀원은 자신의 권한과 인증으로 연결한다.

출력은 gitignore 대상인 `artifacts/analytics/index.html`, `report.json`이다. 화면에서 **최신 데이터 가져오기**를 누르면 서버가 승인된 읽기 전용 인증으로 다시 수집한다. 서버는 loopback만 수신하고 갱신은 같은 Origin에서만 허용하며, 임의 파일/인증정보를 제공하지 않는다. 예약 작업은 없다. 갱신 중에는 마지막 정상 데이터를 보여준다. 로컬 서버가 없으면 저장된 스냅샷만 볼 수 있다. 이 화면은 팀 공용 호스팅 서비스가 아니다.

`get_dutying_analysis_view(service_id, period_key, device)`는 LLM에 이 화면과 같은 집계 근거·월별 추이·출처·날짜·품질 제한을 제공한다. 캐시 생성 시각을 확인하고, 최신 조회가 필요하면 원본 GA 도구 또는 수동 갱신을 사용한다. 기존 `report.py`는 웹 단일 속성의 28일 보조 보고서이므로 새 화면 생성에는 `explorer.py`를 사용한다.

## 유지할 기준

- .ai hostname과 AI app streamId를 정확히 구분한다.
- 사용자를 일별·소스별로 합산하지 않는다. CTA 클릭은 설치·가입이 아니다.
- sign_up은 웹 비밀번호 가입만 보장한다. schedule_confirmed 횟수는 첫 활성화가 아니다.
- GA 주요 이벤트 등록은 sign_up/ward_created/schedule_confirmed이며 금전 기본값은 없다.
- 근거·가설·다음 실험을 구분하고 날짜·분모·시간대·임계값·샘플링·잘린 행을 표시한다.
- 광고비·결제·중복 제거 미검증 상태에서 CAC/ROAS·웹앱 통합 사용자를 확정하지 않는다.

공식 문서: https://developers.google.com/analytics/devguides/MCP · https://developers.google.com/analytics/devguides/collection/ga4/reference/recommended-events · https://firebase.google.com/docs/analytics/flutter/events
