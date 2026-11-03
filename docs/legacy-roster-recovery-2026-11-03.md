# 기존 개인 근무표 가져오기

로그인 화면과 프로필의 개인 이전 링크 및 `/legacy-roster` 전용 페이지를 추가했다. 개인 소셜 OAuth와 app refresh cookie로 인증하며 대상 계정은 서버의 `/accounts/me`에서 확정한다. 개인 access token을 관리자 store·URL·storage에 저장하지 않는다. 본인 개인 ACCOUNT 프로필에서도 기존 근무표 가져오기를 사용할 수 있다. 같은 소셜 계정의 구 근무표를 연도별로 찾거나 보관한 JSON 파일을 가져올 수 있다. 미리보기 후 확정하며 기존 날짜를 보존하고 중복 탭/계정 전환/연도 변경/잘못된 파일/원본 변경을 처리한다. 병동 관리자 프로필에서는 별도 개인 로그인 페이지로 안내하며 병동 연동 계정은 차단한다. 한국어/영어/일본어 제공.

API 계약·원본 DB 연결·OAuth namespace 검증·운영 활성화는 [서버 검증/인수인계 문서](https://github.com/gom-3/dutying-server-ai/blob/develop/docs/legacy-roster-recovery-verification-2026-11-03.md)를 따른다. 원본 연결이 미설정이면 준비 중 안내를 표시한다. 병동/일정/모임 전체 이전이나 운영 활성화 완료를 의미하지 않는다.

검증: 기능·프로필 테스트 69개 통과, TypeScript 및 변경 파일 ESLint 통과, 전체 production build 성공. 실제 브라우저에서 가상 API로 연도 선택→미리보기→확정→완료를 확인했다. 운영 데이터 E2E는 미실행이다.

웹 구현 기준: `5d773877c53952832ab6401094d7b7906e7cd8eb` (origin/develop). 테스트 69개는 프로필 23개, 이전 기능 9개, 개인 세션 2개, 공개 이전 페이지 2개, 로그인/콜백 33개를 포함한다. 기존 “기능·프로필 테스트” 표기는 이 전체 관련 범위를 뜻한다.

담당자는 [최신 인수인계](https://github.com/gom-3/dutying-server-ai/blob/develop/docs/legacy-roster-migration-handoff-2026-11-03.md)에 따라 원본 DB 및 검증한 제공자 설정 → staging MySQL·실제 개인 소셜 로그인 → 미리보기·확정 → 저장 후 앱 조회 → 정상 배포 순으로 확인한다. 아직 운영에서 제공 중이거나 고객 #913의 실제 이전이 완료됐다고 안내하지 않는다. 병동 전체 데이터 이전은 별도 범위다.

운영 반영 검토: Cloudflare Pages는 404.html을 발행하므로 신규 공개 진입 `/legacy-roster`도 정적 앱 경로 목록에 포함해야 한다. 로그인 복귀와 새로고침이 404가 되지 않도록 앱 셸 HTML을 생성하고 SEO 빌드 검증에서 해당 산출물의 존재를 확인한다.
