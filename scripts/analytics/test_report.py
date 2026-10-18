import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import report


class ReportTest(unittest.TestCase):
    def test_periods_and_domain_boundary(self):
        current = report.request_body(*report.REPORTS['current'])
        self.assertEqual(current['dateRanges'], [{'startDate': '28daysAgo', 'endDate': 'yesterday'}])
        self.assertEqual(current['dimensions'], [])  # period-level users, not a daily sum
        self.assertEqual(current['dimensionFilter']['filter']['inListFilter']['values'], report.HOSTS)
        previous = report.request_body(*report.REPORTS['previous'])
        self.assertEqual(previous['dateRanges'][0]['endDate'], '29daysAgo')

    def test_parses_types_and_preserves_quality_flags(self):
        result = report.parse_report({'dimensionHeaders': [{'name': 'date'}], 'metricHeaders': [{'name': 'sessions', 'type': 'TYPE_INTEGER'}, {'name': 'engagementRate', 'type': 'TYPE_FLOAT'}], 'rows': [{'dimensionValues': [{'value': '20261017'}], 'metricValues': [{'value': '12'}, {'value': '0.75'}]}], 'metadata': {'subjectToThresholding': True}, 'rowCount': 1})
        self.assertEqual(result['rows'][0], {'date': '20261017', 'sessions': 12, 'engagementRate': .75})
        self.assertTrue(result['metadata']['subjectToThresholding'])

    def test_disconnected_is_not_zero_and_json_cannot_break_script(self):
        snapshot = report.make_snapshot(None, {})
        self.assertEqual(snapshot['status'], 'not_connected')
        self.assertEqual(snapshot['reports'], {})
        snapshot['source'] = '</script><script>alert(1)</script>'
        with tempfile.TemporaryDirectory() as directory:
            report.write_artifacts(snapshot, Path(directory))
            html = (Path(directory) / 'index.html').read_text()
            self.assertNotIn(snapshot['source'], html)
            self.assertEqual(json.loads((Path(directory) / 'report.json').read_text()), snapshot)

    def test_api_failure_does_not_expose_token(self):
        def fail(request, timeout):
            raise urllib.error.HTTPError(request.full_url, 403, 'secret-token', {}, None)
        with self.assertRaisesRegex(RuntimeError, 'HTTP 403') as caught:
            report.collect('1234', 'secret-token', fail)
        self.assertNotIn('secret-token', str(caught.exception))

    def test_pagination(self):
        calls = []
        def response(request, timeout):
            body = json.loads(request.data)
            calls.append(body['offset'])
            return io.BytesIO(json.dumps({'dimensionHeaders': [], 'metricHeaders': [{'name': 'sessions', 'type': 'TYPE_INTEGER'}], 'rows': [{'metricValues': [{'value': '1'}]}], 'rowCount': 2}).encode())
        with patch.dict(report.REPORTS, {'test': ([], ['sessions'], '28daysAgo', 'yesterday')}, clear=True):
            result = report.collect('1234', 'token', response)
        self.assertEqual(calls, ['0', '1'])
        self.assertEqual(len(result['test']['rows']), 2)


if __name__ == '__main__':
    unittest.main()
