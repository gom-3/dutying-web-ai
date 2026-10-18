from datetime import date
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import explorer

class ExplorerTest(unittest.TestCase):
    def test_periods_have_exact_lengths_and_clip_partial_calendar_months(self):
        periods=explorer.periods(date(2026,10,17))
        for p in periods[:4]:
            self.assertEqual((date.fromisoformat(p['end'])-date.fromisoformat(p['start'])).days+1,p['days'])
            self.assertEqual((date.fromisoformat(p['previousEnd'])-date.fromisoformat(p['previousStart'])).days+1,p['days'])
        months=periods[4:]
        self.assertEqual(months[0]['start'],'2025-10-18')
        self.assertEqual(months[-1]['end'],'2026-10-17')
        self.assertTrue(months[0]['partial']);self.assertTrue(months[-1]['partial'])
        self.assertFalse(months[1]['partial'])
    def test_leap_month_is_not_forced_to_thirty_days(self):
        month=next(p for p in explorer.periods(date(2024,3,15)) if p['key']=='m2024-02')
        self.assertEqual(month['days'],29)
    def test_distinct_users_are_not_summed_across_devices(self):
        s={'id':'a','buckets':{'d30':{'totals':{'rows':[{'activeUsers':10}]},'devices':{'rows':[{'deviceCategory':'mobile','activeUsers':8},{'deviceCategory':'desktop','activeUsers':7}]}}}}
        data={'sources':[s],'periods':[{'key':'d30'}],'generatedAt':'now','gaps':[],'definitions':{}}
        self.assertEqual(explorer.view(data,'a','d30')['current']['activeUsers'],10)
        self.assertEqual(explorer.view(data,'a','d30','mobile')['current']['activeUsers'],8)
    def test_all_device_channels_are_not_added_from_device_rows(self):
        source={'id':'a','buckets':{'d30':{'totals':{'rows':[{'activeUsers':10,'sessions':11}]},'devices':{'rows':[{'deviceCategory':'mobile','activeUsers':8,'sessions':9},{'deviceCategory':'desktop','activeUsers':7,'sessions':5}]},'channels':{'rows':[{'sessionSourceMedium':'google / organic','sessions':7}]},'channelsByDevice':{'rows':[{'deviceCategory':'mobile','sessionSourceMedium':'google / organic','sessions':5},{'deviceCategory':'desktop','sessionSourceMedium':'google / organic','sessions':4}]}}}}
        data={'sources':[source],'periods':[{'key':'d30'}],'generatedAt':'now','gaps':[],'definitions':{}}
        self.assertEqual(explorer.view(data,'a','d30')['current']['sessions'],11)
        self.assertEqual(explorer.view(data,'a','d30')['channels'][0]['sessions'],7)
        self.assertEqual(explorer.view(data,'a','d30','mobile')['channels'][0]['sessions'],5)
    def test_no_records_and_api_failure_are_different(self):
        buckets=explorer.periods(date(2026,10,17))
        with patch('explorer.post',return_value={'rows':[],'rowCount':0}) as request:
            result=explorer.collect_source(explorer.SOURCES[0],buckets,'test')
            self.assertEqual(result['status'],'no_records');self.assertEqual(request.call_count,1)
        with patch('explorer.post',side_effect=RuntimeError('HTTP 403')):
            self.assertEqual(explorer.collect_source(explorer.SOURCES[0],buckets,'test')['status'],'error')
    def test_large_report_set_is_batched_within_google_limit(self):
        batches=[]
        def fake_post(url,body,token):
            if url.endswith(':runReport'):
                return {'dimensionHeaders':[{'name':'date'}],'metricHeaders':[{'name':'eventCount','type':'TYPE_INTEGER'}],'rows':[{'dimensionValues':[{'value':'20261017'}],'metricValues':[{'value':'1'}]}],'rowCount':1}
            batches.append(len(body['requests']))
            return {'reports':[{'rows':[],'rowCount':0} for _ in body['requests']]}
        with patch('explorer.post',side_effect=fake_post):
            result=explorer.collect_source(explorer.SOURCES[0],explorer.periods(date(2026,10,17)),'test')
        self.assertEqual(result['status'],'ready')
        self.assertTrue(all(size<=5 for size in batches))
        self.assertIn('channelsByDevice',result['buckets']['d365'])
        self.assertIn('channels',result['buckets']['d365'])
    def test_unknown_filter_is_rejected(self):
        with self.assertRaises(ValueError):explorer.view({'sources':[],'periods':[]},'private','../secret')
    def test_quality_metadata_and_truncation_are_preserved(self):
        report=explorer.checked({'rowCount':2,'rows':[],'metadata':{'subjectToThresholding':True}})
        self.assertTrue(report['truncated']);self.assertTrue(report['metadata']['subjectToThresholding'])
    def test_embedded_json_cannot_close_script(self):
        with tempfile.TemporaryDirectory() as folder:
            explorer.write({'name':'</script><script>bad()</script>'},folder)
            html=(Path(folder)/'index.html').read_text()
            self.assertNotIn('"name": "</script>',html)
            self.assertEqual(json.loads((Path(folder)/'report.json').read_text())['name'],'</script><script>bad()</script>')

if __name__=='__main__':unittest.main()
