# 공개 랜딩 렌더링

공개 URL `/`, `/en`, `/ja`, `/zh`, `/th`, `/vi`는 빌드 시 실제 React 랜딩을 정적 HTML로 생성한다. 별도 SEO용 임시 화면을 만들지 않는다.

- 화면의 단일 원본: `apps/app/src/pages/landing/landing-page-view.tsx`
- 정적 생성: `entry-server.tsx`와 Vite의 빌드 후처리
- 브라우저 진입: `entry-client.tsx`의 `hydrateRoot`
- 제품 앱 진입: `app-client.tsx`의 기존 SPA

초기 응답에 본문, H1, 이미지, 링크와 필요한 CSS가 모두 포함된다. 첫 화면은 JavaScript나 스크롤 애니메이션을 기다리지 않는다. 모바일/데스크톱 배치는 CSS와 `picture`가 결정하므로 기기 판별 후 페이지를 통째로 교체하지 않는다. 모바일 첫 화면은 앱 다운로드를 강조하고, 아래에서는 같은 제품 설명을 읽을 수 있다.

브라우저에는 현재 언어의 공개 페이지 번역만 전달한다. 로그인된 방문자의 계정과 프로필 기능은 hydration 이후 불러온다. 공개 URL 이동은 실제 문서를 로드해 언어별 메타데이터와 본문을 일치시킨다. 기존 `/?lng=en` 형식은 대응하는 정적 URL로 이동한다.

초대 링크와 공지 상세 같은 동적 앱 주소는 `/app-shell`로 rewrite한다. 이 HTML에는 랜딩 본문이 없으며 `noindex`를 설정한다. 루트 정적 랜딩으로 rewrite하면 안 된다.

빌드 명령과 Cloudflare Pages 출력 경로는 기존 설정을 유지한다. 서버 프로세스나 새 의존성은 필요 없다. Vite 개발 서버는 기존 CSR 경로이므로 최초 HTML과 hydration은 production 빌드의 preview에서 확인한다.

검증:

1. `pnpm --dir apps/app exec tsc -b`
2. `pnpm --dir apps/app exec vitest run src/pages/landing src/app/__tests__/Router.test.tsx`
3. `pnpm build:app`
4. `pnpm verify:seo` (기존 문서 사이트 빌드 결과도 필요)
5. preview에서 데스크톱/모바일, 언어 변경, 앱 진입, JavaScript 없는 상태 확인

6개 언어 hydration 테스트는 초기 main, H1, hero, 링크 DOM이 React 실행 후에도 같은 객체인지 확인한다. 이 검증은 임시 화면 교체가 재발하는 것을 막는다.
