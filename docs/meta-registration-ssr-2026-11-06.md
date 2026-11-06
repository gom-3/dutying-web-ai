# Meta 가입 측정의 서버 렌더링 호환성

공유 growth-analytics 모듈의 react-facebook-pixel 정적 import가 랜딩 HTML 생성 시 window를 참조해 production build를 중단했다. SDK 초기화는 기존 브라우저 진입점에 유지하고, 가입 측정은 초기화된 브라우저 fbq 큐에 동기 전달한다. 개발/미리보기·인증 URL 차단과 제한된 이벤트 필드는 유지한다. Node 환경 모듈 import 회귀 테스트와 실제 production build로 재확인한다.
