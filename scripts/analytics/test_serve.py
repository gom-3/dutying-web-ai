import http.client
from http.server import ThreadingHTTPServer
import threading
import unittest
from unittest.mock import patch
import serve

class ServerTest(unittest.TestCase):
    def setUp(self):
        self.server=ThreadingHTTPServer(('127.0.0.1',0),serve.Handler)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.port=self.server.server_port
    def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join()
    def request(self,method,path,headers=None):
        c=http.client.HTTPConnection('127.0.0.1',self.port)
        c.request(method,path,body='{}' if method=='POST' else None,headers=headers or {})
        r=c.getresponse();status=r.status;body=r.read();c.close();return status,body
    def test_foreign_origin_cannot_start_an_authenticated_query(self):
        with patch('serve.explorer.collect') as collect:
            status,_=self.request('POST','/api/refresh',{'Origin':'https://foreign.example','Content-Type':'application/json'})
            self.assertEqual(status,403);collect.assert_not_called()
    def test_local_user_can_request_refresh_without_browser_credentials(self):
        done=threading.Event()
        previous=dict(serve.STATE)
        def finish():
            serve.STATE.update(status='complete',message='done')
            serve.LOCK.release();done.set()
        try:
            with patch('serve.refresh',side_effect=finish),patch('serve.explorer.collect') as collect:
                status,_=self.request('POST','/api/refresh',{'Origin':f'http://127.0.0.1:{self.port}','Content-Type':'application/json'})
                self.assertEqual(status,202);self.assertTrue(done.wait(2));collect.assert_not_called()
        finally:serve.STATE.update(previous)
    def test_wrong_host_and_arbitrary_files_are_not_served(self):
        self.assertEqual(self.request('GET','/',{'Host':'foreign.example'})[0],403)
        self.assertEqual(self.request('GET','/../../../.codex/config.toml')[0],404)
    def test_status_is_readable_without_disclosing_authentication(self):
        status,body=self.request('GET','/api/status')
        self.assertEqual(status,200);self.assertNotIn(b'access_token',body)

if __name__=='__main__':unittest.main()
