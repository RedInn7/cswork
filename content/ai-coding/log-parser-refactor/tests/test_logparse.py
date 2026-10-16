import unittest

from src.logparse import parse_line, summarize

CLASSIC = '2026-10-15T08:00:01Z [ERROR] payments: card declined user=42 amount=1999'
LOGFMT = 'time=2026-10-15T08:00:02Z level=warn service=search msg="slow query" took_ms=812'
JSON = '{"ts": "2026-10-15T08:00:03Z", "lvl": "info", "svc": "Auth", "msg": "login", "user": 42}'


class ParseLineTest(unittest.TestCase):
    def test_classic_line(self):
        self.assertEqual(parse_line(CLASSIC), {
            'time': '2026-10-15T08:00:01Z', 'level': 'ERROR', 'service': 'payments',
            'message': 'card declined', 'fields': {'amount': '1999', 'user': '42'},
        })

    def test_logfmt_line(self):
        self.assertEqual(parse_line(LOGFMT), {
            'time': '2026-10-15T08:00:02Z', 'level': 'WARNING', 'service': 'search',
            'message': 'slow query', 'fields': {'took_ms': '812'},
        })

    def test_json_line(self):
        self.assertEqual(parse_line(JSON), {
            'time': '2026-10-15T08:00:03Z', 'level': 'INFO', 'service': 'auth',
            'message': 'login', 'fields': {'user': '42'},
        })

    def test_lines_that_are_not_records(self):
        for line in ['', '   ', '# rotated at midnight', 'hello', '2026-10-15T08:00:01Z [LOUD] api: x', 'time=bad level=info service=x']:
            self.assertIsNone(parse_line(line), line)


class SummaryTest(unittest.TestCase):
    def test_summary(self):
        lines = [CLASSIC, LOGFMT, JSON, '', '# note', 'not a log line', CLASSIC.replace('08:00:01', '08:00:09')]
        self.assertEqual(summarize(lines), {
            'lines': 7,
            'skipped': 1,
            'levels': [('INFO', 1), ('WARNING', 1), ('ERROR', 2)],
            'services': [('payments', 2), ('auth', 1), ('search', 1)],
            'first': '2026-10-15T08:00:01Z',
            'last': '2026-10-15T08:00:09Z',
            'recent_errors': [
                '2026-10-15T08:00:01Z payments: card declined',
                '2026-10-15T08:00:09Z payments: card declined',
            ],
        })


if __name__ == '__main__':
    unittest.main()
