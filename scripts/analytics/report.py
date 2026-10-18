#!/usr/bin/env python3
"""Read-only GA4 report. No credentials or raw user records are written to artifacts."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request

HOSTS = ['dutying.ai', 'www.dutying.ai', 'app.dutying.ai']
METRICS = ['activeUsers', 'newUsers', 'sessions', 'engagedSessions', 'engagementRate']
REPORTS = {
    'current': ([], METRICS, '28daysAgo', 'yesterday'),
    'previous': ([], METRICS, '56daysAgo', '29daysAgo'),
    'daily': (['date'], ['activeUsers', 'sessions'], '28daysAgo', 'yesterday'),
    'channels': (['sessionSourceMedium'], ['sessions', 'engagedSessions', 'keyEvents'], '28daysAgo', 'yesterday'),
    'campaigns': (['sessionCampaignName'], ['sessions', 'keyEvents'], '28daysAgo', 'yesterday'),
    'devices': (['deviceCategory'], ['sessions'], '28daysAgo', 'yesterday'),
    'events': (['eventName'], ['eventCount', 'totalUsers'], '28daysAgo', 'yesterday'),
}


def request_body(dimensions, metrics, start, end):
    return {
        'dateRanges': [{'startDate': start, 'endDate': end}],
        'dimensions': [{'name': n} for n in dimensions],
        'metrics': [{'name': n} for n in metrics],
        'dimensionFilter': {'filter': {'fieldName': 'hostName', 'inListFilter': {'values': HOSTS, 'caseSensitive': False}}},
        'limit': '10000',
        'returnPropertyQuota': True,
    }


def parse_report(raw):
    dimensions = [v['name'] for v in raw.get('dimensionHeaders', [])]
    metrics = raw.get('metricHeaders', [])
    rows = []
    for row in raw.get('rows', []):
        result = {name: value['value'] for name, value in zip(dimensions, row.get('dimensionValues', []))}
        for header, value in zip(metrics, row.get('metricValues', [])):
            result[header['name']] = int(value['value']) if header['type'] == 'TYPE_INTEGER' else float(value['value'])
        rows.append(result)
    return {'rows': rows, 'metadata': raw.get('metadata', {}), 'quota': raw.get('propertyQuota', {}), 'rowCount': raw.get('rowCount', 0)}


def access_token():
    if os.environ.get('GA_ACCESS_TOKEN'):
        return os.environ['GA_ACCESS_TOKEN']
    credentials_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if not credentials_path:
        candidate = Path.home() / '.local/share/dutying-analytics/google-credentials.json'
        if candidate.is_file():
            credentials_path = str(candidate)
    if credentials_path:
        try:
            from google.oauth2.credentials import Credentials
            from google.auth.transport.requests import Request
            credentials = Credentials.from_authorized_user_file(credentials_path)
            credentials.refresh(Request())
            return credentials.token
        except Exception:
            raise RuntimeError('승인된 Google 읽기 전용 인증 갱신 실패. 인증 파일과 권한을 확인하세요.') from None
    try:
        result = subprocess.run(['gcloud', 'auth', 'application-default', 'print-access-token'],
                                capture_output=True, text=True, check=True, timeout=30)
        token = result.stdout.strip()
        if token:
            return token
    except (OSError, subprocess.SubprocessError):
        pass
    raise RuntimeError('GA 인증 없음: analytics.readonly 권한의 GA_ACCESS_TOKEN 또는 승인된 gcloud ADC가 필요합니다.')


def collect(property_id, token, opener=urllib.request.urlopen):
    reports = {}
    for name, definition in REPORTS.items():
        body = request_body(*definition)
        url = f'https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport'
        all_rows = []
        while True:
            body['offset'] = str(len(all_rows))
            request = urllib.request.Request(url, data=json.dumps(body).encode(), headers={
                'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
            try:
                with opener(request, timeout=45) as response:
                    parsed = parse_report(json.load(response))
            except urllib.error.HTTPError as error:
                # Do not print request headers, token, or remote response bodies.
                raise RuntimeError(f'GA4 {name} 조회 실패 (HTTP {error.code}). 속성 권한/API 활성화/할당량을 확인하세요.') from None
            all_rows.extend(parsed['rows'])
            if len(all_rows) >= parsed['rowCount']:
                break
            if not parsed['rows'] or len(all_rows) > 100000:
                raise RuntimeError('보고서 페이지 수집이 완료되지 않아 결과를 저장하지 않았습니다.')
        parsed['rows'] = all_rows
        reports[name] = parsed
    return reports


def make_snapshot(property_id, reports):
    now = datetime.now(timezone.utc)
    return {'version': 1, 'status': 'connected' if reports else 'not_connected',
            'source': 'Google Analytics Data API v1beta', 'propertyId': property_id,
            'generatedAt': now.isoformat(), 'hosts': HOSTS,
            'period': '최근 28일 · 오늘 제외 · GA 속성 시간대 기준',
            'comparison': '직전 28일', 'reports': reports}


def write_artifacts(snapshot, output):
    output.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(snapshot, ensure_ascii=False, allow_nan=False)
    safe_payload = payload.replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    template = Path(__file__).with_name('dashboard.html').read_text()
    for name, content in [('report.json', payload), ('index.html', template.replace('__REPORT_DATA__', safe_payload))]:
        target = output / name
        temporary = target.with_suffix(target.suffix + '.tmp')
        temporary.write_text(content)
        temporary.chmod(0o600)
        temporary.replace(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--property', default=os.environ.get('GA_PROPERTY_ID'))
    parser.add_argument('--output', type=Path, default=Path('artifacts/analytics-basic'))
    parser.add_argument('--preview', action='store_true', help='Generate an explicitly disconnected dashboard without contacting GA')
    args = parser.parse_args()
    if not args.preview and (not args.property or not re.fullmatch(r'[0-9]+', args.property)):
        parser.error('--property에 GA4 숫자 속성 ID가 필요합니다 (G- 측정 ID가 아닙니다).')
    try:
        reports = {} if args.preview else collect(args.property, access_token())
        write_artifacts(make_snapshot(args.property, reports), args.output)
    except (RuntimeError, OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print(f'Dashboard: {(args.output / "index.html").resolve()}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
