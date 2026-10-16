"""Characterization tests: the refactored parser must answer exactly like the original, kept
below as legacy_parse_line and legacy_summarize, on chosen lines and on thousands of generated ones."""
import json
import random
import unittest

from src.logparse import parse_line, summarize


def legacy_parse_line(line):
    """One log line as {'time', 'level', 'service', 'message', 'fields'}; None for a blank line,
    a comment (#) or a line that cannot be read."""
    line = line.strip()
    if line == '' or line.startswith('#'):
        return None

    if line.startswith('{'):
        try:
            data = json.loads(line)
        except ValueError:
            return None
        if not isinstance(data, dict):
            return None
        time = data.get('ts') or data.get('time')
        level = data.get('lvl') or data.get('level')
        service = data.get('svc') or data.get('service')
        message = data.get('msg') or data.get('message') or ''
        if not isinstance(time, str) or not isinstance(level, str) or not isinstance(service, str) or not isinstance(message, str):
            return None
        if len(time) != 20 or time[4] != '-' or time[7] != '-' or time[10] != 'T' or time[13] != ':' or time[16] != ':' or time[19] != 'Z':
            return None
        level = level.strip().upper()
        if level == 'D' or level == 'DEBUG' or level == 'TRACE':
            level = 'DEBUG'
        elif level == 'I' or level == 'INFO' or level == 'INFORMATION':
            level = 'INFO'
        elif level == 'W' or level == 'WARN' or level == 'WARNING':
            level = 'WARNING'
        elif level == 'E' or level == 'ERR' or level == 'ERROR':
            level = 'ERROR'
        elif level == 'F' or level == 'FATAL' or level == 'CRIT' or level == 'CRITICAL':
            level = 'CRITICAL'
        else:
            return None
        service = service.strip().lower()
        if service == '' or ' ' in service:
            return None
        fields = {}
        for key in sorted(data):
            if key not in ('ts', 'time', 'lvl', 'level', 'svc', 'service', 'msg', 'message'):
                fields[key] = str(data[key])
        return {'time': time, 'level': level, 'service': service, 'message': message.strip(), 'fields': fields}

    if line[0] in '0123456789':
        time = line.split(' ')[0]
        rest = line[len(time):].strip()
        if not rest.startswith('['):
            return None
        close = rest.find(']')
        if close == -1:
            return None
        level = rest[1:close]
        rest = rest[close + 1:].strip()
        colon = rest.find(':')
        if colon <= 0:
            return None
        service = rest[:colon]
        words = rest[colon + 1:].strip().split(' ')
        fields = {}
        while len(words) > 1 and '=' in words[-1] and not words[-1].startswith('='):
            key = words[-1].split('=', 1)[0]
            value = words[-1].split('=', 1)[1]
            if key not in fields:
                fields[key] = value
            words.pop()
        message = ' '.join(words)
        if len(time) != 20 or time[4] != '-' or time[7] != '-' or time[10] != 'T' or time[13] != ':' or time[16] != ':' or time[19] != 'Z':
            return None
        level = level.strip().upper()
        if level == 'D' or level == 'DEBUG' or level == 'TRACE':
            level = 'DEBUG'
        elif level == 'I' or level == 'INFO' or level == 'INFORMATION':
            level = 'INFO'
        elif level == 'W' or level == 'WARN' or level == 'WARNING':
            level = 'WARNING'
        elif level == 'E' or level == 'ERR' or level == 'ERROR':
            level = 'ERROR'
        elif level == 'F' or level == 'FATAL' or level == 'CRIT' or level == 'CRITICAL':
            level = 'CRITICAL'
        else:
            return None
        service = service.strip().lower()
        if service == '' or ' ' in service:
            return None
        sorted_fields = {}
        for key in sorted(fields):
            sorted_fields[key] = fields[key]
        return {'time': time, 'level': level, 'service': service, 'message': message.strip(), 'fields': sorted_fields}

    if '=' in line:
        pairs = {}
        i = 0
        n = len(line)
        while i < n:
            while i < n and line[i] == ' ':
                i += 1
            if i >= n:
                break
            eq = line.find('=', i)
            if eq == -1:
                return None
            key = line[i:eq]
            if key == '' or ' ' in key:
                return None
            i = eq + 1
            if i < n and line[i] == '"':
                i += 1
                value = ''
                while i < n and line[i] != '"':
                    if line[i] == '\\' and i + 1 < n:
                        i += 1
                    value += line[i]
                    i += 1
                if i >= n:
                    return None
                i += 1
            else:
                end = line.find(' ', i)
                if end == -1:
                    end = n
                value = line[i:end]
                i = end
            pairs[key] = value
        time = pairs.get('time') or pairs.get('ts')
        level = pairs.get('level') or pairs.get('lvl')
        service = pairs.get('service') or pairs.get('svc')
        message = pairs.get('msg') or pairs.get('message') or ''
        if time is None or level is None or service is None:
            return None
        if len(time) != 20 or time[4] != '-' or time[7] != '-' or time[10] != 'T' or time[13] != ':' or time[16] != ':' or time[19] != 'Z':
            return None
        level = level.strip().upper()
        if level == 'D' or level == 'DEBUG' or level == 'TRACE':
            level = 'DEBUG'
        elif level == 'I' or level == 'INFO' or level == 'INFORMATION':
            level = 'INFO'
        elif level == 'W' or level == 'WARN' or level == 'WARNING':
            level = 'WARNING'
        elif level == 'E' or level == 'ERR' or level == 'ERROR':
            level = 'ERROR'
        elif level == 'F' or level == 'FATAL' or level == 'CRIT' or level == 'CRITICAL':
            level = 'CRITICAL'
        else:
            return None
        service = service.strip().lower()
        if service == '' or ' ' in service:
            return None
        fields = {}
        for key in sorted(pairs):
            if key not in ('ts', 'time', 'lvl', 'level', 'svc', 'service', 'msg', 'message'):
                fields[key] = pairs[key]
        return {'time': time, 'level': level, 'service': service, 'message': message.strip(), 'fields': fields}

    return None


def legacy_summarize(lines):
    """The dashboard's summary of a batch of lines."""
    total = 0
    skipped = 0
    by_level = {}
    by_service = {}
    first = None
    last = None
    errors = []
    for line in lines:
        total += 1
        record = legacy_parse_line(line)
        if record is None:
            if line.strip() != '' and not line.strip().startswith('#'):
                skipped += 1
            continue
        if record['level'] in by_level:
            by_level[record['level']] += 1
        else:
            by_level[record['level']] = 1
        if record['service'] in by_service:
            by_service[record['service']] += 1
        else:
            by_service[record['service']] = 1
        if first is None or record['time'] < first:
            first = record['time']
        if last is None or record['time'] > last:
            last = record['time']
        if record['level'] == 'ERROR' or record['level'] == 'CRITICAL':
            errors.append(record['time'] + ' ' + record['service'] + ': ' + record['message'])
    errors.sort()
    levels = []
    for level in ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']:
        if level in by_level:
            levels.append((level, by_level[level]))
    services = []
    for service in sorted(by_service, key=lambda s: (-by_service[s], s)):
        if len(services) < 10:
            services.append((service, by_service[service]))
    return {
        'lines': total,
        'skipped': skipped,
        'levels': levels,
        'services': services,
        'first': first,
        'last': last,
        'recent_errors': errors[-5:],
    }


TIMES = ['2026-10-15T08:00:01Z', '2026-10-15T08:00:01', '2026-10-15 08:00:01Z', '2026-1-15T08:00:01Z', 'xxxx-xx-xxTxx:xx:xxZ',
         '2026-10-15T08:00:01.5Z', '2026-10-14T23:59:59Z', '2026-10-16T00:00:00Z', '', '2026-10-15t08:00:01z']
LEVELS = ['ERROR', 'error', ' Warn ', 'W', 'i', 'INFORMATION', 'trace', 'D', 'crit', 'Fatal', 'ERR', 'notice', '', 'E R R']
SERVICES = ['payments', 'Auth', ' search ', '', 'two words', 'tab\tbed', 'API-gw', 'x']
WORDS = ['card', 'declined', 'slow', 'query', '', 'user=42', 'amount=1999', '=oops', 'k=', 'k=v=w', 'user=7', 'a"b', '\\"', 'é']
KEYS = ['time', 'ts', 'level', 'lvl', 'service', 'svc', 'msg', 'message', 'took_ms', 'user', 'a b', '', 'x"y']


def pick(rng, pool):
    """Mostly the first, well-formed value, so most generated lines are records."""
    return pool[0] if rng.random() < 0.6 else rng.choice(pool)


def classic(rng):
    words = [rng.choice(WORDS) for _ in range(rng.randrange(0, 6))]
    head = '[%s]' % rng.choice(LEVELS) if rng.random() < 0.8 else rng.choice(['[%s' % rng.choice(LEVELS), rng.choice(LEVELS)])
    service = pick(rng, SERVICES) + (':' if rng.random() < 0.8 else rng.choice(['', ' :']))
    return pick(rng, TIMES) + rng.choice([' ', ' ', '  ', '\t ']) + head + ' ' + service + ' ' + ' '.join(words)


def logfmt_value(rng):
    value = rng.choice(TIMES + LEVELS + SERVICES + WORDS)
    style = rng.randrange(4)
    if style == 0:
        return value.replace(' ', '')
    if style == 1:
        return '"%s"' % value.replace('\\', '\\\\').replace('"', '\\"')
    if style == 2:
        return '"%s' % value
    return '"%s\\' % value


def logfmt(rng):
    pairs = []
    keys = rng.sample(KEYS, rng.randrange(1, 7))
    if rng.random() < 0.7:
        keys = [rng.choice(['time', 'ts']), rng.choice(['level', 'lvl']), rng.choice(['service', 'svc'])] + keys
    for key in keys:
        if key in ('time', 'ts'):
            value = pick(rng, TIMES).replace(' ', 'T')
        elif key in ('level', 'lvl'):
            value = rng.choice(LEVELS).strip().replace(' ', '')
        elif key in ('service', 'svc') and rng.random() < 0.6:
            value = 'payments'
        else:
            value = logfmt_value(rng)
        pairs.append('%s=%s' % (key, value))
    return rng.choice([' ', '  ']).join(pairs)


def json_line(rng):
    values = TIMES + LEVELS + SERVICES + WORDS + [0, 1.5, None, True, [], {'a': 1}, [1, 'x']]
    data = {key: rng.choice(values) for key in rng.sample(KEYS, rng.randrange(0, 8))}
    for key, pool in (('ts', TIMES), ('lvl', LEVELS), ('svc', SERVICES)):
        if rng.random() < 0.7:
            data[key] = pick(rng, pool)
    text = json.dumps(data, ensure_ascii=rng.random() < 0.5)
    return text if rng.random() < 0.9 else text[:-1]


def generated(rng):
    kind = rng.randrange(10)
    if kind < 3:
        return classic(rng)
    if kind < 6:
        return logfmt(rng)
    if kind < 9:
        return json_line(rng)
    return rng.choice(['', '   ', '# comment', '  # indented comment', 'plain text', '[]', '{}', '[1, 2]', '5 apples', '=', 'a=1 =2'])


KNOWN = [
    '2026-10-15T08:00:01Z [ERROR] payments: card declined user=42 amount=1999',
    '2026-10-15T08:00:01Z [ERROR] payments: card declined user=42 user=43',
    '2026-10-15T08:00:01Z [ warn ] Search: slow  k=v',
    'time=2026-10-15T08:00:02Z level=warn service=search msg="slow query" took_ms=812',
    'ts=2026-10-15T08:00:02Z lvl=E svc=api msg="say \\"hi\\"" msg=second',
    'time=2026-10-15T08:00:02Z level=info service=api msg="unclosed',
    'time=2026-10-15T08:00:02Z \tlevel=info service=api msg=tabbed',
    'time=2026-10-15T08:00:02Z level=info service=api a="x"b=2 msg="\\',
    '{"ts": "2026-10-15T08:00:03Z", "lvl": "info", "svc": "auth", "msg": "login", "user": 42, "ok": true}',
    '{"ts": "", "time": "2026-10-15T08:00:03Z", "level": "fatal", "service": "Auth", "message": "  down  "}',
    '{"ts": "2026-10-15T08:00:03Z", "lvl": "info", "svc": "auth", "msg": 5}',
    '', '# rotated', 'garbage', '[1, 2]',
]


class LogParserCharacterizationTest(unittest.TestCase):
    def test_known_answers(self):
        self.assertEqual(parse_line(KNOWN[0]), {
            'time': '2026-10-15T08:00:01Z', 'level': 'ERROR', 'service': 'payments', 'message': 'card declined',
            'fields': {'amount': '1999', 'user': '42'},
        })
        self.assertEqual(parse_line('ts=2026-10-15T08:00:02Z lvl=E svc=api msg=first msg=second')['message'], 'second')
        self.assertIsNone(parse_line('time=2026-10-15T08:00:02Z level=info service=api msg="unclosed'))
        line = '{"ts": "2026-10-15T08:00:03Z", "lvl": "info", "svc": "auth", "user": 42, "ok": true}'
        self.assertEqual(parse_line(line)['fields'], {'ok': 'True', 'user': '42'})

    def test_chosen_lines(self):
        for line in KNOWN:
            self.assertEqual(parse_line(line), legacy_parse_line(line), line)

    def test_generated_classic_lines(self):
        rng = random.Random(1)
        for _ in range(3000):
            line = classic(rng)
            self.assertEqual(parse_line(line), legacy_parse_line(line), line)

    def test_generated_logfmt_lines(self):
        rng = random.Random(2)
        for _ in range(3000):
            line = logfmt(rng)
            self.assertEqual(parse_line(line), legacy_parse_line(line), line)

    def test_generated_json_lines(self):
        rng = random.Random(3)
        for _ in range(3000):
            line = json_line(rng)
            self.assertEqual(parse_line(line), legacy_parse_line(line), line)

    def test_summaries(self):
        rng = random.Random(4)
        self.assertEqual(summarize([]), legacy_summarize([]))
        self.assertEqual(summarize(KNOWN), legacy_summarize(KNOWN))
        for size in (1, 5, 40, 400):
            for _ in range(20):
                lines = [generated(rng) for _ in range(size)]
                self.assertEqual(summarize(lines), legacy_summarize(lines))

    def test_summary_of_a_generator(self):
        self.assertEqual(summarize(line for line in KNOWN), legacy_summarize(KNOWN))


if __name__ == '__main__':
    unittest.main()
