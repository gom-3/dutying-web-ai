"""Year-scale, read-only service analytics. Only aggregate data reaches the browser."""
import argparse
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
from zoneinfo import ZoneInfo
import urllib.error
import urllib.parse
import urllib.request
from report import access_token, parse_report

ROOT = Path(__file__).resolve().parents[2]
METRICS = ['activeUsers', 'newUsers', 'sessions', 'engagedSessions', 'screenPageViews', 'eventCount']

def values(field, items):
    return {'filter': {'fieldName': field, 'inListFilter': {'values': items, 'caseSensitive': True}}}

SOURCES = [
    {'id': 'ai_web_history', 'name': 'AI 웹 · 기존 수집 경로', 'service': 'ai', 'surface': 'web', 'property': '394593452', 'boundary': values('hostName', ['dutying.ai','www.dutying.ai','app.dutying.ai']), 'note': '과거 .ai 웹 기록. 새 경로와 중복 합산하지 않습니다.'},
    {'id': 'ai_web', 'name': 'AI 웹 · 새 수집 경로', 'service': 'ai', 'surface': 'web', 'property': '551586530', 'boundary': {'andGroup': {'expressions': [values('streamId',['16150940090']),values('hostName',['dutying.ai','www.dutying.ai','app.dutying.ai'])]}}, 'note': '새 태그 배포 후 수신되는 기록입니다.'},
    {'id': 'ai_app', 'name': 'AI 앱 · 새 수집 경로', 'service': 'ai', 'surface': 'app', 'property': '551586530', 'boundary': values('streamId',['15500007523','15500030482']), 'note': 'ai.dutying.app · 새 AI 속성.'},
    {'id': 'ai_app_previous', 'name': 'AI 앱 · 이전 수집 경로', 'service': 'ai', 'surface': 'app', 'property': '406327786', 'boundary': values('streamId',['15481397214','15489331448']), 'note': 'ai.dutying.app · 기존 모바일 속성 안의 AI 앱 스트림.'},
    {'id': 'legacy_web', 'name': '기존 듀팅 웹 · .net', 'service': 'legacy', 'surface': 'web', 'property': '394593452', 'boundary': values('hostName',['dutying.net','www.dutying.net','app.dutying.net']), 'note': '별도 운영 중인 기존 서비스. AI 웹과 다른 서비스입니다.'},
    {'id': 'legacy_app', 'name': '기존 듀팅 앱', 'service': 'legacy', 'surface': 'app', 'property': '406327786', 'boundary': values('streamId',['6098856174','6098969981','6093514411','6093592257']), 'note': 'com.gom3.dutying 등 기존 앱. AI 앱 사용자가 아닙니다.'},
]

def periods(end):
    result = []
    for days in [30,90,180,365]:
        start = end - timedelta(days=days-1)
        result.append({'key': f'd{days}', 'label': f'최근 {days}일', 'start': start.isoformat(), 'end': end.isoformat(), 'kind': 'rolling', 'days': days})
    start = end - timedelta(days=364)
    cursor = start.replace(day=1)
    while cursor <= end:
        last = cursor.replace(day=monthrange(cursor.year,cursor.month)[1])
        a,b = max(start,cursor),min(end,last)
        result.append({'key': cursor.strftime('m%Y-%m'), 'label': cursor.strftime('%Y년 %m월'), 'start': a.isoformat(), 'end': b.isoformat(), 'kind':'month', 'days':(b-a).days+1, 'partial': a != cursor or b != last})
        cursor = (last + timedelta(days=1))
    for item in result:
        a = date.fromisoformat(item['start'])
        item['previousStart']=(a-timedelta(days=item['days'])).isoformat()
        item['previousEnd']=(a-timedelta(days=1)).isoformat()
    return result

def post(url, body, token):
    request = urllib.request.Request(url,json.dumps(body).encode(),{'Authorization':'Bearer '+token,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(request,timeout=90) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'조회 실패 HTTP {error.code}; 권한·할당량·API 상태를 확인하세요.') from None
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError('분석 서버에 연결하지 못했습니다. 기존 집계를 유지합니다.') from None

def request(source, dimensions, metrics, ranges):
    return {'dimensions':[{'name':n} for n in dimensions], 'metrics':[{'name':n} for n in metrics],
            'dateRanges':ranges, 'dimensionFilter':source['boundary'], 'limit':10000, 'returnPropertyQuota':True}

def checked(raw):
    parsed=parse_report(raw)
    parsed['truncated']=len(parsed['rows']) < parsed['rowCount']
    return parsed

def collect_source(source, buckets, token, progress=lambda _:None):
    result={**source, 'status':'ready', 'buckets':{}}
    url=f"https://analyticsdata.googleapis.com/v1beta/properties/{source['property']}"
    try:
        daily=checked(post(url+':runReport',request(source,['date'],['sessions','eventCount'],[{'startDate':buckets[3]['start'],'endDate':buckets[3]['end']}]),token))
        result['daily']=daily
        dates=[r['date'] for r in daily['rows'] if r.get('eventCount',0)>0]
        result['coverage']={'firstRecorded':min(dates) if dates else None,'lastRecorded':max(dates) if dates else None,'windowStart':buckets[3]['start'],'windowEnd':buckets[3]['end']}
        progress(source['name']+' · 수집 범위 확인')
        if not dates:
            result['status']='no_records'
            return result
        result['dailyDevices']=checked(post(url+':runReport',request(source,['date','deviceCategory'],['sessions','eventCount'],[{'startDate':buckets[3]['start'],'endDate':buckets[3]['end']}]),token))
        definitions=[('totals',[],METRICS),('devices',['deviceCategory'],METRICS),('channels',['sessionSourceMedium'],['sessions','engagedSessions']),('events',['eventName'],['eventCount']),('systems',['deviceCategory','operatingSystem'],['sessions','activeUsers']),('channelsByDevice',['deviceCategory','sessionSourceMedium'],['sessions','engagedSessions']),('eventsByDevice',['deviceCategory','eventName'],['eventCount'])]
        for bucket in buckets:
            ranges=[{'startDate':bucket['start'],'endDate':bucket['end']},{'startDate':bucket['previousStart'],'endDate':bucket['previousEnd']}]
            raw={'reports':[]}
            for offset in range(0,len(definitions),5):
                batch=post(url+':batchRunReports',{'requests':[request(source,dims,metrics,ranges) for _,dims,metrics in definitions[offset:offset+5]]},token)
                raw['reports'].extend(batch.get('reports',[]))
            if len(raw.get('reports',[])) != len(definitions):
                raise RuntimeError('분석 응답이 완전하지 않습니다.')
            result['buckets'][bucket['key']]={name:checked(response) for (name,_,_),response in zip(definitions,raw['reports'])}
            progress(source['name']+' · '+bucket['label'])
    except RuntimeError as error:
        result['status']='error'; result['error']=str(error)
    return result

def collect_search(token, start, end):
    result={'status':'ready','site':'sc-domain:dutying.ai','timezone':'America/Los_Angeles','start':start,'end':end}
    base='https://www.googleapis.com/webmasters/v3/sites/'+urllib.parse.quote(result['site'],safe='')+'/searchAnalytics/query'
    try:
        for name,dimensions in [('daily',['date','device']),('queries',['query','device'])]:
            response=post(base,{'startDate':start,'endDate':end,'dimensions':dimensions,'rowLimit':25000,'dataState':'final','type':'web'},token)
            result[name]=response.get('rows',[])
        result['queryLimit']='검색어 행은 익명 처리·상위 행 제한으로 전체 검색 합계와 다를 수 있습니다. 검색어 표는 조회된 1년 전체 기준입니다.'
    except RuntimeError as error:
        result['status']='error';result['error']=str(error)
    return result

def collect(progress=lambda _:None, end=None):
    end=end or (datetime.now(ZoneInfo('Asia/Seoul')).date()-timedelta(days=1))
    buckets=periods(end)
    token=access_token()
    # Two properties can share multiple logical sources; at most one batch per property at a time.
    sources=[collect_source(source,buckets,token,progress) for source in SOURCES]
    if all(s['status']=='error' for s in sources):
        raise RuntimeError('모든 GA 소스 조회가 실패했습니다. 이전 파일을 유지합니다.')
    search=collect_search(token,buckets[3]['start'],end.isoformat())
    return {'version':2,'generatedAt':datetime.now(timezone.utc).isoformat(),'periods':buckets,'sources':sources,'search':search,
            'source':'Google Analytics Data API / Search Console API','gaTimezone':'Asia/Seoul',
            'definitions':{'activeUsers':'선택 기간의 중복 제거 활성 사용자. 월별·기기별·서비스별로 더하지 않습니다.','sessions':'방문 수. 한 사람이 여러 번 방문할 수 있습니다.','engagementRate':'참여 세션 / 전체 세션. 기기별 비율을 단순 평균하지 않습니다.','eventCount':'행동 발생 횟수. 가입자·활성화 사용자 수 또는 순차 퍼널이 아닙니다.'},
            'gaps':['광고비·결제·매출은 미연결이므로 CAC/ROAS를 산출하지 않습니다.','Meta API 미연결. Instagram 브라우저 인사이트는 이 집계에 포함되지 않습니다.','가입·병동 생성·확정 성공 이벤트는 운영 배포 후부터 수집됩니다.','기록 없음은 수집되지 않았다는 뜻이며, 서비스 이용자 0명이라는 뜻이 아닙니다.','관찰과 다음 행동은 지표 규칙으로 정리합니다. 원인·인과관계는 추가 AI 분석 및 검증이 필요합니다.']}

def write(snapshot, output):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    payload=json.dumps(snapshot,ensure_ascii=False,allow_nan=False)
    safe=payload.replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    html=Path(__file__).with_name('explorer.html').read_text().replace('__DATA__',safe)
    for name,content in [('index.html',html),('report.json',payload)]:
        path=output/name;tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(content);tmp.chmod(0o600);tmp.replace(path)

def view(snapshot, service, period, device='all'):
    source=next((s for s in snapshot['sources'] if s['id']==service),None)
    bucket=next((p for p in snapshot['periods'] if p['key']==period),None)
    if not source or not bucket or device not in ['all','desktop','mobile','tablet','smart tv','(not set)']:
        raise ValueError('알 수 없는 서비스·기간·기기입니다.')
    reports=source['buckets'].get(period,{})
    def rows(name,index=0):
        return [r for r in reports.get(name,{}).get('rows',[]) if r.get('dateRange','date_range_0')==f'date_range_{index}' and (device=='all' or r.get('deviceCategory')==device)]
    def total(index):
        return (rows('totals' if device=='all' else 'devices',index) or [None])[0]
    search=snapshot.get('search',{})
    search_rows=[r for r in search.get('daily',[]) if bucket.get('start','')<=r['keys'][0]<=bucket.get('end','') and (device=='all' or r['keys'][1].lower()==device)]
    search_summary={'scope':'sc-domain:dutying.ai; independent of selected service','timezone':'America/Los_Angeles','state':search.get('status','unavailable'),'clicks':sum(r['clicks'] for r in search_rows) if search_rows else None,'impressions':sum(r['impressions'] for r in search_rows) if search_rows else None,'recordedDateStart':min((r['keys'][0] for r in search_rows),default=None),'recordedDateEnd':max((r['keys'][0] for r in search_rows),default=None)}
    return {'generatedAt':snapshot['generatedAt'],'source':{k:source.get(k) for k in ['id','name','property','boundary','status','coverage','error']},'period':bucket,'device':device,'current':total(0),'previous':total(1),'channels':rows('channels' if device=='all' else 'channelsByDevice'),'events':rows('events' if device=='all' else 'eventsByDevice'),'systems':rows('systems'),'search':search_summary,'inventory':[{k:s.get(k) for k in ['id','name','status','coverage','error']} for s in snapshot['sources']],'monthly':[{'period':m, 'values':next((r for r in source['buckets'].get(m['key'],{}).get('totals' if device=='all' else 'devices',{}).get('rows',[]) if r.get('dateRange','date_range_0')=='date_range_0' and (device=='all' or r.get('deviceCategory')==device)),None)} for m in snapshot['periods'] if m.get('kind')=='month'],'quality':{k:{x:v.get(x) for x in ['metadata','truncated','rowCount']} for k,v in reports.items()},'gaps':snapshot['gaps'],'definitions':snapshot['definitions']}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'artifacts/analytics')
    args=parser.parse_args()
    snapshot=collect(lambda message:print(message,flush=True))
    write(snapshot,args.output)
    print('분석 탐색 화면 저장 완료:',args.output/'index.html')
if __name__=='__main__':main()
