#!/usr/bin/env bash
# .ai 컷오버 검증 — 새 prod API 전환 전후로 돌려 무엇이 남았는지 한눈에 본다.
#
#   ./scripts/verify-ai-cutover.sh                      # 현재 prod API(.net) 기준
#   API=https://api.dutying.ai ./scripts/verify-ai-cutover.sh   # 새 API 기준
set -uo pipefail

API="${API:-https://api.dutying.net}"
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

hdr "보안 헤더 (5/5 기대)"
for h in www.dutying.ai app.dutying.ai docs.dutying.ai dev.dutying.ai; do
    n=$(curl -sS -o /dev/null -D - -m 12 "https://$h/" 2>/dev/null \
        | grep -icE 'strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy')
    [ "$n" = 5 ] && ok "$h" "$n/5" || bad "$h" "$n/5"
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
for p in /accounts/me /accounts/waiting /wards \
         /oauth2/authorization/admin/kakao \
         /auth/admin/password/login /auth/admin/password/signup \
         /auth/admin/social/signup /auth/admin/email-verifications \
         /admin/accounts/me /admin/wards /accounts/me/admin-workspace; do
    c=$(code "$API$p")
    [ "$c" = 404 ] && bad "$p" "$c 라우트 없음" || ok "$p" "$c"
done

hdr "CORS (app.dutying.ai → $API)"
origin=$(curl -sS -o /dev/null -D - -m 15 -X OPTIONS \
    -H 'Origin: https://app.dutying.ai' -H 'Access-Control-Request-Method: GET' \
    "$API/accounts/me" 2>/dev/null | grep -i '^access-control-allow-origin' | tr -d '\r' | cut -d' ' -f2)
[ "$origin" = "https://app.dutying.ai" ] && ok "allow-origin" "$origin" || bad "allow-origin" "${origin:-없음}"

hdr "구 서비스 (.net — 무손상이어야 함)"
c=$(code https://www.dutying.net/)
[ "$c" = 200 ] && ok "www.dutying.net" "$c" || bad "www.dutying.net" "$c"

printf '\n'
[ "$FAIL" = 0 ] && printf '\033[32m전부 통과\033[0m\n' || printf '\033[31m실패 항목 있음 (위 ✗)\033[0m\n'
exit "$FAIL"
