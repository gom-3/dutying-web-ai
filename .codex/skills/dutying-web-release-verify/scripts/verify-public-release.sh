#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: verify-public-release.sh --url URL [--expect-text TEXT]

Read-only public response check for a Dutying web release. A successful result
proves URL reachability and an optional visible marker, not the provider's Git
commit. Confirm the deployed commit separately in the deployment provider.
USAGE
}

url=""
expected_text=""

while (($# > 0)); do
  case "$1" in
    --url)
      (($# >= 2)) || { usage >&2; exit 2; }
      url="$2"
      shift 2
      ;;
    --expect-text)
      (($# >= 2)) || { usage >&2; exit 2; }
      expected_text="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

[[ "$url" =~ ^https://[A-Za-z0-9.-]+([/?#][^[:space:]]*)?$ ]] || { echo "invalid HTTPS URL" >&2; exit 2; }
[[ "$expected_text" != *$'\n'* && "$expected_text" != *$'\r'* ]] || { echo "invalid expected text" >&2; exit 2; }

response_file=$(mktemp)
trap 'rm -f "$response_file"' EXIT

http_code=$(curl -fsSL --max-time 15 -o "$response_file" -w '%{http_code}' "$url")
[[ "$http_code" == "200" ]] || { echo "http_status=${http_code}" >&2; exit 1; }

if [[ -n "$expected_text" ]]; then
  grep -Fq -- "$expected_text" "$response_file" || { echo "expected text not found" >&2; exit 1; }
fi

printf 'url=%s\nhttp_status=%s\n' "$url" "$http_code"
if [[ -n "$expected_text" ]]; then
  printf 'expected_text_found=yes\n'
fi
