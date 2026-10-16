"""Reads the mixed application logs our services write into records, and builds the summary the
on-call dashboard shows. Two alerting jobs read the summary too, so its keys and values must stay
exactly as they are.

Three line formats exist, from three generations of services:

    2026-10-15T08:00:01Z [ERROR] payments: card declined user=42 amount=1999
    time=2026-10-15T08:00:02Z level=warn service=search msg="slow query" took_ms=812
    {"ts": "2026-10-15T08:00:03Z", "lvl": "info", "svc": "auth", "msg": "login", "user": 42}
"""
import json
from collections import Counter

LEVELS = {
    'D': 'DEBUG', 'DEBUG': 'DEBUG', 'TRACE': 'DEBUG',
    'I': 'INFO', 'INFO': 'INFO', 'INFORMATION': 'INFO',
    'W': 'WARNING', 'WARN': 'WARNING', 'WARNING': 'WARNING',
    'E': 'ERROR', 'ERR': 'ERROR', 'ERROR': 'ERROR',
    'F': 'CRITICAL', 'FATAL': 'CRITICAL', 'CRIT': 'CRITICAL', 'CRITICAL': 'CRITICAL',
}
LEVEL_ORDER = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
# Keys that name a record's own parts; every other key becomes a field.
KNOWN_KEYS = {'ts', 'time', 'lvl', 'level', 'svc', 'service', 'msg', 'message'}


def parse_line(line):
    """One log line as {'time', 'level', 'service', 'message', 'fields'}; None for a blank line,
    a comment (#) or a line that cannot be read."""
    line = line.strip()
    if line == '' or line.startswith('#'):
        return None
    if line.startswith('{'):
        return _parse_json(line)
    if line[0] in '0123456789':
        return _parse_classic(line)
    if '=' in line:
        return _parse_logfmt(line)
    return None


def _record(time, level, service, message, fields):
    """The record for these parts, or None when one of them is missing or malformed."""
    if not all(isinstance(part, str) for part in (time, level, service, message)):
        return None
    level = LEVELS.get(level.strip().upper())
    service = service.strip().lower()
    if not _is_timestamp(time) or level is None or service == '' or ' ' in service:
        return None
    return {'time': time, 'level': level, 'service': service, 'message': message.strip(), 'fields': dict(sorted(fields.items()))}


def _is_timestamp(text):
    """YYYY-MM-DDTHH:MM:SSZ by its separators: characters 4, 7, 10, 13, 16 and 19."""
    return len(text) == 20 and text[4::3] == '--T::Z'


def _extra_fields(pairs, as_text):
    return {key: as_text(value) for key, value in pairs.items() if key not in KNOWN_KEYS}


def _parse_json(line):
    try:
        data = json.loads(line)
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    return _record(
        data.get('ts') or data.get('time'),
        data.get('lvl') or data.get('level'),
        data.get('svc') or data.get('service'),
        data.get('msg') or data.get('message') or '',
        _extra_fields(data, str),
    )


def _parse_classic(line):
    """2026-10-15T08:00:01Z [LEVEL] service: message key=value ..."""
    time = line.split(' ')[0]
    rest = line[len(time):].strip()
    close = rest.find(']')
    if not rest.startswith('[') or close == -1:
        return None
    level, rest = rest[1:close], rest[close + 1:].strip()
    colon = rest.find(':')
    if colon <= 0:
        return None
    message, fields = _trailing_fields(rest[colon + 1:].strip().split(' '))
    return _record(time, level, rest[:colon], message, fields)


def _trailing_fields(words):
    """The message and the key=value words at its end; the last of a repeated key wins."""
    fields = {}
    while len(words) > 1 and '=' in words[-1] and not words[-1].startswith('='):
        key, value = words.pop().split('=', 1)
        fields.setdefault(key, value)
    return ' '.join(words), fields


def _parse_logfmt(line):
    """key=value pairs; a value may be "quoted", with backslash escapes."""
    pairs = _logfmt_pairs(line)
    if pairs is None:
        return None
    return _record(
        pairs.get('time') or pairs.get('ts'),
        pairs.get('level') or pairs.get('lvl'),
        pairs.get('service') or pairs.get('svc'),
        pairs.get('msg') or pairs.get('message') or '',
        _extra_fields(pairs, str),
    )


def _logfmt_pairs(line):
    """The pairs of a logfmt line, a later key replacing an earlier one; None when it is malformed."""
    pairs = {}
    i = 0
    while i < len(line):
        if line[i] == ' ':
            i += 1
            continue
        eq = line.find('=', i)
        key = line[i:eq]
        if eq == -1 or key == '' or ' ' in key:
            return None
        value, i = _logfmt_value(line, eq + 1)
        if value is None:
            return None
        pairs[key] = value
    return pairs


def _logfmt_value(line, i):
    """The value starting at i and the index after it; None for an unclosed quote."""
    if not line.startswith('"', i):
        end = line.find(' ', i)
        end = len(line) if end == -1 else end
        return line[i:end], end
    chars = []
    i += 1
    while i < len(line) and line[i] != '"':
        if line[i] == '\\' and i + 1 < len(line):
            i += 1
        chars.append(line[i])
        i += 1
    return (''.join(chars), i + 1) if i < len(line) else (None, i)


def summarize(lines):
    """The dashboard's summary of a batch of lines."""
    parsed = [(line, parse_line(line)) for line in lines]
    records = [record for _, record in parsed if record]
    # Unreadable lines; blank lines and comments are not counted.
    unread = [line for line, record in parsed if record is None and line.strip() and not line.strip().startswith('#')]
    by_level = Counter(record['level'] for record in records)
    by_service = Counter(record['service'] for record in records)
    times = [record['time'] for record in records]
    errors = sorted(
        '%s %s: %s' % (record['time'], record['service'], record['message'])
        for record in records
        if record['level'] in ('ERROR', 'CRITICAL')
    )
    return {
        'lines': len(parsed),
        'skipped': len(unread),
        'levels': [(level, by_level[level]) for level in LEVEL_ORDER if level in by_level],
        'services': sorted(by_service.items(), key=lambda item: (-item[1], item[0]))[:10],
        'first': min(times, default=None),
        'last': max(times, default=None),
        'recent_errors': errors[-5:],
    }
