"""Loopback-only analytics viewer. Read-only upstream APIs, refresh only on user request."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from urllib.parse import urlparse, parse_qs
import explorer

STATE={'status':'idle','message':'마지막 저장된 데이터입니다.'}
LOCK=threading.Lock()
OUTPUT=explorer.ROOT/'artifacts/analytics'

def refresh():
    try:
        def progress(message): STATE.update(status='running',message=message)
        snapshot=explorer.collect(progress)
        explorer.write(snapshot,OUTPUT)
        STATE.update(status='complete',message='최신 집계를 저장했습니다.')
    except Exception:
        STATE.update(status='error',message='조회 실패. 마지막 정상 데이터를 유지합니다.')
    finally: LOCK.release()

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def valid_host(self):
        return self.headers.get('Host') in {f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
    def send(self,status,body,kind='application/json; charset=utf-8'):
        if not isinstance(body,bytes):body=json.dumps(body,ensure_ascii=False).encode()
        self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_GET(self):
        if not self.valid_host():return self.send(403,{'error':'Host rejected'})
        route=urlparse(self.path)
        if route.path=='/api/status':return self.send(200,STATE)
        if route.path=='/api/view':
            try:
                q=parse_qs(route.query)
                snapshot=json.loads((OUTPUT/'report.json').read_text())
                return self.send(200,explorer.view(snapshot,q.get('service',['ai_web_history'])[0],q.get('period',['d365'])[0],q.get('device',['all'])[0]))
            except (ValueError,OSError):return self.send(400,{'error':'선택 조건 또는 저장 데이터가 올바르지 않습니다.'})
        routes={'/':(OUTPUT/'index.html','text/html'),'/index.html':(OUTPUT/'index.html','text/html'),'/artifacts/analytics/index.html':(OUTPUT/'index.html','text/html'),'/report.json':(OUTPUT/'report.json','application/json'),'/team-guide.html':(explorer.ROOT/'docs/analytics/team-guide.html','text/html'),'/README.md':(explorer.ROOT/'docs/analytics/README.md','text/plain'),'/contracts/growth-events.schema.json':(explorer.ROOT/'docs/contracts/growth-events.schema.json','application/json')}
        item=routes.get(route.path)
        if not item:return self.send(404,{'error':'Not found'})
        try:return self.send(200,item[0].read_bytes(),item[1]+'; charset=utf-8')
        except OSError:return self.send(404,{'error':'집계를 먼저 생성하세요.'})
    def do_POST(self):
        if not self.valid_host() or self.headers.get('Origin') not in {f'http://127.0.0.1:{self.server.server_port}',f'http://localhost:{self.server.server_port}'}:
            return self.send(403,{'error':'Same-origin request required'})
        if self.path!='/api/refresh':return self.send(404,{'error':'Not found'})
        if self.headers.get('Content-Type')!='application/json':return self.send(415,{'error':'JSON required'})
        try:length=int(self.headers.get('Content-Length','0'))
        except ValueError:return self.send(400,{'error':'Invalid request'})
        if not 0<=length<=1024:return self.send(413,{'error':'Request too large'})
        self.rfile.read(length)
        if not LOCK.acquire(blocking=False):return self.send(202,STATE)
        STATE.update(status='running',message='Google 원본을 조회합니다.')
        threading.Thread(target=refresh,daemon=True).start()
        return self.send(202,STATE)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--port',type=int,default=8795);args=parser.parse_args()
    print(f'Analytics: http://127.0.0.1:{args.port}/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
