#!/usr/bin/env python3
"""Read-only public preflight. No credentials, payments or configuration changes."""
import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

EXPECTED = {
    'plan': 'PLUS', 'maxChargeGross': 1000000, 'currency': 'KRW',
    'termsVersion': 'plus-monthly-2026-10-11',
}
UNAVAILABLE = {'COMMERCIAL_NOT_ENABLED', 'POLICY_NOT_CONFIGURED'}


def offer_errors(body, require_ready=False):
    if not isinstance(body, dict):
        return ['JSON object required']
    if body.get('code') in UNAVAILABLE and body.get('ready') is False:
        return [f'{body["code"]}: server reachable; published Plus product unavailable']
    errors = [f'{key}: expected {value!r}' for key, value in EXPECTED.items()
              if type(body.get(key)) is not type(value) or body.get(key) != value]
    # Prices and allowances are operator-published policy, not fixed product constants.
    # Reject malformed/unsafe numbers while accepting legitimate policy changes.
    for field in ('baseGross', 'includedStaff', 'adminSeats', 'extraStaffGross', 'generate', 'adjust'):
        value = body.get(field)
        minimum = 1 if field in ('baseGross', 'includedStaff', 'adminSeats') else 0
        if type(value) is not int or not minimum <= value <= 9007199254740991:
            errors.append(f'{field}: expected safe integer >= {minimum}')
    if type(body.get('baseGross')) is int and type(body.get('maxChargeGross')) is int:
        if body['baseGross'] > body['maxChargeGross']:
            errors.append('baseGross exceeds card charge limit')
    if not isinstance(body.get('priceVersion'), str) or not body['priceVersion']:
        errors.append('priceVersion missing')
    if not isinstance(body.get('ready'), bool):
        errors.append('ready must be boolean')
    elif require_ready and not body['ready']:
        errors.append('review/checkout not enabled: ' + str(body.get('code', 'NOT_READY')))
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
            try:
                response = urllib.request.urlopen(request, timeout=15)
            except urllib.error.HTTPError as error:
                # Old deployed servers may return structured setup errors with HTTP 503.
                # Preserve the actual reason instead of reporting an unexplained outage.
                if is_offer and error.headers.get_content_type() == 'application/json':
                    body = json.loads(error.read(1024 * 1024))
                    if isinstance(body, dict) and body.get('code') in UNAVAILABLE:
                        raise ValueError(f'{body["code"]}: published Plus policy is not available') from error
                raise
            with response:
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
                    detail = (f'published Plus policy valid: base={body["baseGross"]} KRW, '
                              f'includedStaff={body["includedStaff"]}, extra={body["extraStaffGross"]} KRW; '
                              f'ready={body["ready"]}')
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
