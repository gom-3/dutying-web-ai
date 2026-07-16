# Universal Links AASA — 브랜치별 위치 (머지 주의)

모바일 앱 Universal Links용 `apple-app-site-association` 파일을 **브랜치마다 다른 경로**에 두었습니다.  
`main` ↔ `develop` 를 합칠 때 아래를 읽고 처리하세요.

## 왜 갈라져 있나

| 도메인 | Vercel 배포 브랜치 | 레포 구조 | AASA 경로 |
|--------|-------------------|-----------|-----------|
| `www.dutying.ai` (prod) | **main** | 구 단일 앱 (`public/` 루트) | `public/.well-known/apple-app-site-association` |
| `dev.dutying.ai` (dev) | **develop** | pnpm 모노레포 | `apps/landing/public/.well-known/...` 및 `apps/app/public/.well-known/...` |

prod에 develop 전체(미완료 기능)를 올리지 않으려고, **AASA만 main에 hotfix**로 넣었습니다.  
develop의 AASA 커밋과 main의 AASA 커밋은 **히스토리가 다르고 경로도 다릅니다.** 버그 아닙니다.

## 합칠 때 규칙

1. **프로덕션이 계속 구 `main` 구조면**  
   - `main`의 `public/.well-known/apple-app-site-association` 유지  
   - develop 쪽 `apps/*/public/.well-known/` 는 모노레포 배포용으로 유지

2. **프로덕션을 모노레포(develop)로 전환할 때**  
   - AASA는 `apps/landing` (및 필요 시 `apps/app`) `public/.well-known/` 기준으로 가져갈 것  
   - 구 `main`의 루트 `public/.well-known/` 는 더 이상 쓰지 않으면 제거  
   - `vercel.json`의 AASA `Content-Type` 헤더도 해당 앱 설정으로 이전

3. **충돌 나면**  
   - JSON 내용(appID·paths)은 동일하면 어느 쪽이든 내용 유지  
   - **경로/구조는 배포 대상 브랜치 구조에 맞출 것** (구 루트 `public/` vs `apps/*/public/`)

## 검증

```bash
curl -i https://www.dutying.ai/.well-known/apple-app-site-association
curl -i https://dev.dutying.ai/.well-known/apple-app-site-association
```

기대: HTTP 200, body JSON, 리다이렉트 없음, `Content-Type: application/json`

관련 모바일 문서: `dutying-flutter` README「남은 일 (인수인계 TODO)」, `docs/deep-link-setup.md`
