# Dutying growth reporting

검토일: 2026-10-18. 설계: [design-2026-10-18.md](design-2026-10-18.md). 사람이 읽는 연결/운영 요약: [connection-report.html](connection-report.html).

## 현재 상태

공식 계정 `gom3.official@gmail.com`에서 확인했다. 운영 웹의 `G-94QM502EQF`는 기존 .net용 `dutying-web` 속성 394593452의 태그다. `dutying-ai` 속성 551586530에는 앱 스트림만 있었으며 최근 48시간 수신 데이터가 없었다.

이번에 .ai 속성에 웹 스트림 **16150940090 / G-WT44BR53VN**을 생성하고 향상된 측정을 끈 상태로 저장했다. 새 웹 코드는 이 태그를 기본으로 사용하고 레거시 `VITE_GA_TRACKING_ID`를 무시한다. 새 재정의 변수는 `VITE_AI_GA_TRACKING_ID`다. 기존 .net 속성 설정은 변경하지 않았다.

운영 배포, 새 태그 수신 검증, Data API 인증, 앱 SDK, 검색·광고·매출 연동 및 정기 집계 활성화는 아직 완료하지 않았다. 현재 로컬 화면은 인증 전 미리보기다. 브라우저의 GA 로그인과 로컬 Data API 인증은 별개다.

## 실행

Python 3.9+ 표준 라이브러리만 사용한다. 저장 결과는 gitignore의 `artifacts/`에 두며 외부 공개하지 않는다.

```sh
# 연결 전 화면 미리보기 (실제 지표 없음)
python3 scripts/analytics/report.py --preview
# 이미 승인된 읽기 전용 인증이 있는 경우
python3 scripts/analytics/report.py --property 551586530
# 검증
python3 -m unittest discover -s scripts/analytics -p 'test_*.py'
```

인증은 환경변수 `GA_ACCESS_TOKEN` 또는 기존 `gcloud auth application-default print-access-token`을 사용한다. 토큰을 명령줄 인자·보고서·Git에 넣지 않는다. GA Data API 활성화와 해당 속성 조회 권한이 필요하다. 인증을 새로 만들거나 범위를 넓히는 작업은 사용자의 해당 인증 승인 이후 진행한다. `G-WT44BR53VN`는 웹 측정 ID이며 숫자 속성 ID로 사용할 수 없다. 단기 토큰만으로는 지속적인 자동화가 되지 않는다.

출력: `artifacts/analytics/index.html`과 `report.json`. HTML은 외부 CDN 없이 열린다. 파일은 로컬 스냅샷이며 자동으로 새 데이터를 fetch하지 않는다. 스케줄러가 같은 집계 명령을 주기적으로 실행한 뒤 화면을 새로 열거나 새로고침해야 한다. API 호출 실패 시 명령은 실패 종료하고 기존 파일을 덮어쓰지 않는다. 마지막 생성 시각을 반드시 확인한다. 생성 파일은 소유자만 읽을 수 있게 저장한다.

## 수치 정의

- 활성/신규 사용자: GA 기간 집계. 일별 사용자 수를 더하지 않는다.
- 세션/참여율: GA 정의. UA pageviews와 혼용하지 않는다.
- `page_view`: React 라우터의 pathname 진입. 같은 pathname의 쿼리/해시 변경은 제외한다. 초기 자동 page_view와 향상된 측정은 비활성화한다. page_location에는 허용된 UTM/광고 클릭 ID만 포함한다.
- `web_cta_click`, `app_store_click`: 랜딩 CTA 클릭. 설치/가입/구매로 해석하지 않는다. `destination`은 web/ios/android의 고정 값만 사용한다.
- 주요 이벤트(`keyEvents`): GA 관리자가 지정한 이벤트 집계. 확인 전에는 구매 전환으로 표현하지 않는다.
- 소스/매체와 캠페인은 세션 기준. 직접 유입이나 `(not set)`도 숨기지 않는다. 웹 hostname 필터로 앱과 .net을 제외한다.
- 이벤트 표는 개별 행동 집계이며 순차 funnel·재방문 코호트가 아니다.
- 표 상위 15개, 일별 표 최대 31일. JSON에는 전체 페이지네이션 결과가 있다.
- GA 임계값/샘플링/(other) 메타데이터를 표시한다. 최근 수치는 후처리되므로 정산 수치와 구별한다.

## 연결 후 순서

1. 새 .ai 속성 551586530의 시간대·보존 기간을 확인한다. 과거 .ai 웹 실적은 기존 394593452 속성에서 hostname으로 분리해 조회한다. 과거 데이터는 새 속성으로 자동 이전되지 않는다.
2. 웹 PR 배포 후 DebugView/실시간 보고서로 첫 진입, SPA 이동, 웹 CTA, iOS/Android 스토어 이동을 검증한다. dev/preview에서는 호출이 없는지 확인한다.
3. 첫 보고서를 생성하고 GA 화면과 동일 날짜/호스트/측정항목으로 대조한다. 실제 가입 완료/근무표 저장 성공/결제 승인 이벤트는 별도 계약 검증 후 추가한다.
4. Search Console 검색 쿼리·노출·클릭, Ads/Meta 광고비, 앱 Analytics 스트림을 연결한다. 앱 활성·유지율이 들어오기 전 웹/앱 통합 KPI를 만들지 않는다.
5. 승인된 갱신 가능한 인증을 마련하고 매일 09:00 KST 보고서 갱신, 매주 월요일 요약을 설정한다. 실패·인증 만료·오래된 결과를 알리고, 반복 알림은 의미 있는 변경에 한정한다. 이 PR에는 실행되는 스케줄을 설치하지 않았다.
6. 팀 공유가 필요하면 같은 GA4를 Looker Studio에 연결한다. 이 로컬 도구를 인증 없는 공개 웹서버에 배포하지 않는다.

## AI 활용 기준

GA Ask Advisor는 속성 권한과 제공 범위 내에서 질문/보고서 탐색에 사용한다. PostHog는 AI 대시보드 작성·제품 퍼널·마케팅 통합이 필요할 때 다음 후보지만 신규 SDK와 데이터 보관·요금 확인 없이 중복 도입하지 않는다. 현재 대시보드는 집계 JSON과 검증 기준을 복사하는 기능이며 자동 LLM 분석 서비스가 아니다. 외부 AI로 자동 업로드하지 않는다.

공식 근거:
- https://developers.google.com/analytics/devguides/reporting/data/v1/basics
- https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications
- https://support.google.com/analytics/answer/16675569
- https://posthog.com/docs/web-analytics/marketing-analytics
- https://posthog.com/docs/product-analytics/dashboards
