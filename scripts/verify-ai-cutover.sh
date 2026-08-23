#!/usr/bin/env bash
# .ai 컷오버 검증 — 새 prod API 전환 전후로 돌려 무엇이 남았는지 한눈에 본다.
#
#   ./scripts/verify-ai-cutover.sh                       # 컷오버된 prod API(.ai) 기준
#   API=https://api.dutying.net ./scripts/verify-ai-cutover.sh   # 구 API 를 다시 보고 싶을 때
set -uo pipefail

# 2026-08-23 컷오버 완료 — app.dutying.ai 번들이 실제로 이 호스트를 부른다.
API="${API:-https://api.dutying.ai}"
FAIL=0

hdr()  { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %-46s %s\n' "$1" "$2"; }
bad()  { printf '  \033[31m✗\033[0m %-46s %s\n' "$1" "$2"; FAIL=1; }

code() { curl -sS -o /dev/null -m 12 -w '%{http_code}' "$1" 2>/dev/null || echo 000; }
srv()  { curl -sS -o /dev/null -D - -m 12 "$1" 2>/dev/null | grep -i '^server:' | tr -d '\r' | cut -d' ' -f2; }

hdr "웹 호스트"
for h in www.dutying.ai app.dutying.ai docs.dutying.ai dev.dutying.ai; do
    c=$(code "https://$h/"); s=$(srv "https://$h/")
    [ "$c" = 200 ] && [ "$s" = cloudflare ] && ok "$h" "$c $s" || bad "$h" "$c $s"
done

# apex 는 NS 를 Cloudflare 로 넘겨야 산다 (zone apex 에 CNAME 불가)
c=$(code https://dutying.ai/)
[ "$c" = 200 ] || [ "$c" = 301 ] || [ "$c" = 308 ] \
    && ok "dutying.ai (apex)" "$c" \
    || bad "dutying.ai (apex)" "$c — NS 전환 필요"

# 2026-08-23 회귀 방지: apex CNAME 이 apps/landing(Astro)의 멈춘 스냅샷을 가리키고 있었다.
# 지금은 "root -> WWW" 리다이렉트 규칙이 apex 를 먼저 가로채서 드러나지 않았지만,
# 그 규칙을 끄거나 지우는 순간 apex 가 옛 랜딩을 서빙하게 되는 잠복 경로였다.
# apex 를 끝까지 따라갔을 때 나오는 것이 앱이어야 한다.
body=$(curl -sSL -m 20 https://dutying.ai/ 2>/dev/null)
if grep -q 'id="root"' <<<"$body" && ! grep -q '_astro' <<<"$body"; then
    ok "apex 최종 도착지가 앱" "SPA root 있음 / 옛 랜딩 번들 없음"
else
    bad "apex 최종 도착지가 앱" "_astro 번들이 보이면 apex CNAME 이 dutying-landing 을 가리킨다"
fi

hdr "보안 헤더 (5/5 기대)"
for h in www.dutying.ai app.dutying.ai docs.dutying.ai dev.dutying.ai; do
    n=$(curl -sS -o /dev/null -D - -m 12 "https://$h/" 2>/dev/null \
        | grep -icE 'strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy')
    [ "$n" = 5 ] && ok "$h" "$n/5" || bad "$h" "$n/5"
done

hdr "호스트 <-> 앱 매핑"
# 2026-08-23 회귀 방지: www 가 한때 apps/landing(Astro)의 멈춘 스냅샷을 서빙했고
# 진짜 랜딩(apps/app 안, 6개 언어)은 app 서브도메인에 숨어 있었다.
# www 는 앱이어야 하고, 모든 호스트의 canonical 은 www 하나로 모여야 한다.
for h in www.dutying.ai app.dutying.ai dev.dutying.ai; do
    body=$(curl -sS -m 15 "https://$h/" 2>/dev/null)
    if grep -q 'id="root"' <<<"$body"; then
        ok "$h 가 앱을 서빙" "SPA root 있음"
    else
        bad "$h 가 앱을 서빙" "SPA root 없음 - 랜딩이 붙었을 수 있다"
    fi
done
for h in www.dutying.ai app.dutying.ai; do
    c=$(curl -sS -m 15 "https://$h/" 2>/dev/null | grep -oE 'canonical" href="[^"]*"' | head -1 | cut -d'"' -f3)
    [ "$c" = "https://www.dutying.ai/" ] && ok "$h canonical" "$c" \
                                         || bad "$h canonical" "${c:-없음} (www 로 모여야 한다)"
done

hdr "색인 정책"
grep -q 'Disallow' <(curl -sS -m 12 https://dev.dutying.ai/robots.txt 2>/dev/null) \
    && ok "dev.dutying.ai noindex" "Disallow: /" \
    || bad "dev.dutying.ai noindex" "운영과 중복 색인 중"
grep -q 'Allow' <(curl -sS -m 12 https://app.dutying.ai/robots.txt 2>/dev/null) \
    && ok "app.dutying.ai index" "Allow: /" \
    || bad "app.dutying.ai index" "색인이 막혀 있다"

hdr "AASA (딥링크)"
for h in www.dutying.ai app.dutying.ai; do
    ct=$(curl -sS -o /dev/null -D - -m 12 "https://$h/.well-known/apple-app-site-association" 2>/dev/null \
         | grep -i '^content-type' | tr -d '\r' | cut -d' ' -f2)
    [[ "$ct" == application/json* ]] && ok "$h" "$ct" || bad "$h" "${ct:-없음}"
done

hdr "API: $API"
# 404 면 그 라우트가 없는 서버다. 인증이 필요한 라우트는 401/403/405 가 정상.
# /admin/wards 는 제외한다 — dev·prod 모두 무인증 404 를 내는 정상 동작이라
# 여기 넣으면 영구 오탐이 된다 (앱은 인증 후에만 호출한다).
for p in /accounts/me /accounts/waiting /wards \
         /oauth2/authorization/admin/kakao \
         /auth/admin/password/login /auth/admin/password/signup \
         /auth/admin/social/signup /auth/admin/email-verifications \
         /admin/accounts/me /accounts/me/admin-workspace; do
    c=$(code "$API$p")
    [ "$c" = 404 ] && bad "$p" "$c 라우트 없음" || ok "$p" "$c"
done

hdr "CORS (app.dutying.ai → $API)"
origin=$(curl -sS -o /dev/null -D - -m 15 -X OPTIONS \
    -H 'Origin: https://app.dutying.ai' -H 'Access-Control-Request-Method: GET' \
    "$API/accounts/me" 2>/dev/null | grep -i '^access-control-allow-origin' | tr -d '\r' | cut -d' ' -f2)
[ "$origin" = "https://app.dutying.ai" ] && ok "allow-origin" "$origin" || bad "allow-origin" "${origin:-없음}"

hdr ".ai API 가동 상태"
aiapi=$(curl -sS -o /dev/null -m 10 -w '%{http_code}' https://api.dutying.ai/readyz 2>/dev/null); aiapi=${aiapi:-000}
[ "$aiapi" = 200 ] && ok "api.dutying.ai" "$aiapi" \
                   || bad "api.dutying.ai" "미가동 ($aiapi) — 502 면 앱 컨테이너 재기동 중"

# 프론트가 실제로 무엇을 부르는지 확인한다. 환경변수 설정과 배포된 번들은 어긋날 수 있다.
entry=$(curl -sS -m 12 https://app.dutying.ai/ 2>/dev/null | grep -oE '/assets/[^"]*index[^"]*\.js' | head -1)
if [ -n "$entry" ]; then
    used=$(curl -sS -m 20 "https://app.dutying.ai$entry" 2>/dev/null \
           | grep -oE 'https://[a-z.]*api\.dutying\.[a-z]+' | sort -u | tr '\n' ' ')
    [ "${used% }" = "https://api.dutying.ai" ] && ok "배포 번들이 부르는 API" "${used% }" \
                                               || bad "배포 번들이 부르는 API" "${used:-확인 실패}"
else
    bad "배포 번들이 부르는 API" "엔트리 스크립트를 찾지 못함"
fi
devapi=$(curl -sS -o /dev/null -m 10 -w '%{http_code}' https://dev.api.dutying.ai/readyz 2>/dev/null); devapi=${devapi:-000}
[ "$devapi" = 200 ] && ok "dev.api.dutying.ai" "$devapi (새 서버 dev 가동 중)" \
                    || bad "dev.api.dutying.ai" "$devapi"

hdr "구 서비스 (.net — 무손상이어야 함)"
c=$(code https://www.dutying.net/)
[ "$c" = 200 ] && ok "www.dutying.net" "$c" || bad "www.dutying.net" "$c"

printf '\n'
[ "$FAIL" = 0 ] && printf '\033[32m전부 통과\033[0m\n' || printf '\033[31m실패 항목 있음 (위 ✗)\033[0m\n'
exit "$FAIL"
