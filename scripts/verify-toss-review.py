#!/usr/bin/env python3
"""Read-only public preflight. No credentials, payments or configuration changes."""
import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

EXPECTED = {
    'plan': 'PLUS', 'baseGross': 19900, 'includedStaff': 50,
    'extraStaffGross': 990, 'generate': 30, 'adjust': 10,
    'adminSeats': 10, 'maxChargeGross': 1000000, 'currency': 'KRW',
    'termsVersion': 'plus-monthly-2026-10-11',
}


def offer_errors(body, require_ready=False):
    if not isinstance(body, dict):
        return ['JSON object required']
    if body.get('code') == 'COMMERCIAL_NOT_ENABLED' and body.get('ready') is False:
        return ['COMMERCIAL_NOT_ENABLED: server reachable; commercial feature disabled, setup/payment verification pending']
    errors = [f'{key}: expected {value!r}' for key, value in EXPECTED.items()
              if type(body.get(key)) is not type(value) or body.get(key) != value]
    if not isinstance(body.get('priceVersion'), str) or not body['priceVersion']:
        errors.append('priceVersion missing')
    if not isinstance(body.get('ready'), bool):
        errors.append('ready must be boolean')
    elif require_ready and not body['ready']:
        errors.append('review/checkout not enabled')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--web', default='https://dev.dutying.ai')
    parser.add_argument('--api', default='https://dev.api.dutying.ai')
    parser.add_argument('--require-ready', action='store_true')
    args = parser.parse_args()
    for base in (args.web, args.api):
        parsed = urllib.parse.urlsplit(base)
        if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
            parser.error('Use HTTPS base URLs without credentials, queries or fragments')
    checks = [(args.web.rstrip('/') + route, False) for route in
              ('/pricing', '/refund', '/subscription-terms')]
    checks.append((args.api.rstrip('/') + '/commercial/offer', True))
    failed = False
    for url, is_offer in checks:
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Dutying-Review-Preflight/1.0'})
            with urllib.request.urlopen(request, timeout=15) as response:
                content_type = response.headers.get_content_type()
                raw = response.read(1024 * 1024)
                if response.geturl().rstrip('/') != url.rstrip('/'):
                    raise ValueError('unexpected redirect; check routing/login protection')
                if is_offer:
                    if content_type != 'application/json':
                        raise ValueError('offer must return JSON, not an SPA/login page')
                    body = json.loads(raw)
                    errors = offer_errors(body, args.require_ready)
                    if errors:
                        raise ValueError('; '.join(errors))
                    detail = f'Plus policy matches; ready={body["ready"]}'
                else:
                    if content_type != 'text/html' or not raw.strip():
                        raise ValueError('expected nonempty HTML')
                    detail = 'HTML reachable (rendered content not verified)'
                print(f'PASS {url}: {detail}')
        except (urllib.error.URLError, ValueError, TimeoutError, OSError) as error:
            failed = True
            print(f'FAIL {url}: {error}')
    print('This does not prove deployed commit, UI behavior, DB readiness or successful Toss payment.')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
