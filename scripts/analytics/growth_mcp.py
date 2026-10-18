"""Read-only Search Console tools for verified Dutying domains."""
from datetime import date
from pathlib import Path
import os
from typing import Literal
from urllib.parse import quote
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import AuthorizedSession
from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations

mcp = FastMCP('Dutying Search Console')
READ = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)
BASE = 'https://www.googleapis.com/webmasters/v3'
CREDENTIALS = Path(os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', str(Path.home() / '.local/share/dutying-analytics/google-credentials.json')))

def request(method, path, body=None):
    if not CREDENTIALS.exists():
        raise ValueError('Google read-only OAuth connection is not completed.')
    credentials = Credentials.from_authorized_user_file(str(CREDENTIALS))
    with AuthorizedSession(credentials) as session:
        response = session.request(method, BASE + path, json=body, timeout=45)
        if response.status_code != 200:
            raise ValueError(f'Search Console request failed (HTTP {response.status_code}); check authorization and API activation.')
        return response.json()

@mcp.tool(annotations=READ)
def list_dutying_sites() -> dict:
    """List accessible Dutying AI and legacy .net properties and permission levels."""
    data = request('GET', '/sites')
    return {'siteEntry':[s for s in data.get('siteEntry', []) if s.get('siteUrl') in ('sc-domain:dutying.ai','sc-domain:dutying.net')]}

@mcp.tool(annotations=READ)
def query_search_performance(start_date: str, end_date: str,
    site: Literal['sc-domain:dutying.ai','sc-domain:dutying.net']='sc-domain:dutying.ai',
    dimensions: list[Literal['date','query','page','country','device','searchAppearance']] | None=None,
    row_limit: int=100, start_row: int=0) -> dict:
    """Query finalized Google search clicks, impressions, CTR and rank. Dates use Pacific time. Query/page rows are top results, not exhaustive totals; use no dimensions for aggregate totals. Pagination uses start_row."""
    start, end = date.fromisoformat(start_date), date.fromisoformat(end_date)
    if start > end or not 1 <= row_limit <= 25000 or start_row < 0:
        raise ValueError('Invalid date interval or pagination.')
    dims = dimensions or []
    if len(dims) != len(set(dims)):
        raise ValueError('Duplicate dimensions are not allowed.')
    body = {'startDate':start.isoformat(),'endDate':end.isoformat(), 'dimensions':dims,
            'rowLimit':row_limit,'startRow':start_row,'type':'web','dataState':'final'}
    result = request('POST','/sites/'+quote(site,safe='')+'/searchAnalytics/query', body)
    return {'site':site,'request':body,'timezone':'America/Los_Angeles',
            'limitation':'API returns top rows; query/page totals may exclude anonymized data.', 'result':result}

@mcp.tool(annotations=READ)
def query_dutying_growth(start_date: str, end_date: str) -> dict:
    """Return grounded web acquisition, successful outcomes, AI app stream coverage and finalized search totals as structured JSON. No profile data. GA dates are Seoul, search dates Pacific; do not sum cross-source users. Legacy web property is selected until the new stream receives verified production data."""
    from datetime import timedelta
    start, end = date.fromisoformat(start_date), date.fromisoformat(end_date)
    days = (end - start).days + 1
    if not 1 <= days <= 93:
        raise ValueError('Use a complete interval of 1 to 93 days.')
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)
    ranges = [{'startDate': start.isoformat(), 'endDate': end.isoformat()},
              {'startDate': previous_start.isoformat(), 'endDate': previous_end.isoformat()}]
    credentials = Credentials.from_authorized_user_file(str(CREDENTIALS))
    host_filter = {'filter': {'fieldName': 'hostName', 'inListFilter': {'values': ['www.dutying.ai', 'app.dutying.ai', 'dutying.ai']}}}
    outcome_filter = {'andGroup': {'expressions': [host_filter, {'filter': {'fieldName': 'eventName', 'inListFilter': {'values': ['sign_up', 'login', 'ward_created', 'schedule_confirmed', 'schedule_published', 'web_cta_click', 'app_store_click', 'Auth_login', 'auth_login', 'first_visit']}}}]}}
    def ga(session, prop, dims, metrics, boundary):
        body = {'dateRanges': ranges, 'dimensions': [{'name': n} for n in dims],
                'metrics': [{'name': n} for n in metrics], 'dimensionFilter': boundary, 'limit': 1000}
        response = session.post('https://analyticsdata.googleapis.com/v1beta/properties/' + prop + ':runReport', json=body, timeout=45)
        if response.status_code != 200:
            return {'property': prop, 'http_status': response.status_code, 'available': False}
        return {'property': prop, 'available': True, 'request': body, 'report': response.json()}
    with AuthorizedSession(credentials) as session:
        reports = {
            'web_totals': ga(session, '394593452', [], ['activeUsers', 'newUsers', 'sessions', 'engagedSessions'], host_filter),
            'web_acquisition': ga(session, '394593452', ['sessionSourceMedium'], ['sessions', 'engagedSessions'], host_filter),
            'web_outcomes': ga(session, '394593452', ['eventName'], ['eventCount', 'totalUsers'], outcome_filter),
            'ai_mobile': ga(session, '406327786', ['streamId', 'platform'], ['activeUsers', 'eventCount'], {'filter': {'fieldName': 'streamId', 'inListFilter': {'values': ['15481397214', '15489331448']}}}),
        }
    try:
        search = query_search_performance(start.isoformat(), end.isoformat())
    except ValueError as error:
        search = {'available': False, 'error': str(error)}
    return {'schema_version': 1, 'current_period': ranges[0], 'previous_period': ranges[1],
            'ga_timezone': 'Asia/Seoul', 'search_timezone': 'America/Los_Angeles',
            'reports': reports, 'search': search,
            'measurement_limits': ['New web measurement migration is not deployed; verify source before changing property.',
                'Legacy Auth_login is not a signup event. Empty AI app rows mean no recorded usage in these streams.',
                'No verified Meta API data or ad spend; do not calculate blended CAC/ROAS.',
                'Events are occurrences. Do not divide event counts to claim ordered user funnel conversion.',
                'Inspect metadata for sampling/thresholding; report rowCount vs returned rows before claiming exhaustive coverage.',
                'Search final data may lag the requested end date.']}

if __name__ == '__main__':
    mcp.run()
