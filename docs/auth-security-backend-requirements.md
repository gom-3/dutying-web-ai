# 로그인/회원가입 보안 백엔드 보완 요청

프론트에서 OAuth 콜백 URL 토큰 즉시 제거, 로그아웃 revoke 호출, 기본 보안 헤더를 보완했습니다. access token 비영속화는 백엔드 refresh cookie 정책이 준비된 뒤 함께 적용하는 것이 안전합니다. 아래 항목은 백엔드에서 확정해야 하는 보안 요구사항입니다.

## 1. OAuth 콜백 토큰 전달 방식 변경

현재 프론트는 레거시 호환을 위해 `/oauth2/redirect?accessToken=...` 형태를 처리합니다. 운영 보안 기준에서는 URL에 access token을 싣지 않도록 변경이 필요합니다.

- 권장 방식: OAuth authorization code + PKCE
- 대안: 백엔드가 HttpOnly `Secure` `SameSite=Lax` 또는 `Strict` 쿠키로 세션/refresh token을 설정하고 프론트에는 `/oauth2/redirect?next=...`만 전달
- OAuth `state` 값으로 CSRF 방지와 `nextPageUrl` 무결성 검증
- `nextPageUrl`은 서버에서도 app origin allow-list 검증
- OAuth 콜백/`nextPageUrl`은 환경별 프론트 도메인을 유지
  - production: `https://app.dutying.ai/oauth2/redirect`, `nextPageUrl=https://app.dutying.ai/...`
  - dev: `https://dev.dutying.ai/oauth2/redirect`, `nextPageUrl=https://dev.dutying.ai/...`
  - local 필요 시: `https://local.app.dutying.net:3000/oauth2/redirect`
  - dev 로그인 요청이 production `app.dutying.ai`으로 돌아가면 안 됩니다.

## 2. Refresh/Logout 토큰 정책

- 백엔드 refresh cookie 정책이 적용되기 전까지 프론트는 기존 호환을 위해 access token 저장을 유지합니다.
- refresh token은 HttpOnly `Secure` 쿠키로만 저장
- 쿠키 `Domain`, `Path`, `SameSite`, 만료 시간 명시
- `/token/refresh`는 refresh token rotation 적용
- `/token/blacklist` 또는 logout API는 access token 폐기와 refresh token 폐기를 함께 처리
- 로그아웃 응답에서 refresh cookie 만료 처리

## 3. 로그인/회원가입 Abuse 방어

- 로그인 실패 rate limit: IP + 계정 기준 조합
- 이메일 인증번호 발송 rate limit: IP + 이메일 기준 조합
- 인증번호/비밀번호 재설정 토큰 TTL, 최대 시도 횟수, 사용 후 즉시 폐기
- 로그인/비밀번호 재설정/이메일 인증 요청은 계정 존재 여부가 드러나지 않는 공통 응답 문구 사용

## 4. 비밀번호/계정 저장 정책

- 비밀번호는 bcrypt, Argon2id 등 검증된 단방향 해시 사용
- 최소 길이와 흔한 비밀번호 차단 정책 적용
- 관리자 계정 이메일은 소문자/trim 정규화 후 unique 처리
- 회원가입의 이메일 인증 완료 여부와 약관 동의 여부는 서버에서 최종 검증

## 5. 운영 보안 헤더/CORS

- API CORS origin allow-list를 환경별 필요한 프론트 도메인으로 제한
  - production: `https://app.dutying.ai`
  - dev: `https://dev.dutying.ai`
  - local 필요 시: `https://local.app.dutying.net:3000`
- credential 요청 허용 시 wildcard origin 금지
- CSP는 프론트 SDK 목록을 확정한 뒤 배포 환경에서 적용
- 인증 관련 API 응답에는 민감 데이터, debug token, stack trace 미포함

## 6. 감사 로그

- 관리자 로그인 성공/실패, 로그아웃, 비밀번호 재설정, 이메일 인증, 토큰 재발급 이벤트 기록
- 관리자 권한 변경, 병동 입장/초대 수락 같은 권한 이벤트 기록
- 로그에는 token/password/인증번호 원문 저장 금지
