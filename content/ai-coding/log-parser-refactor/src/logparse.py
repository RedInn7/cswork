"""Reads the mixed application logs our services write into records, and builds the summary the
on-call dashboard shows. Two alerting jobs read the summary too, so its keys and values must stay
exactly as they are.

Three line formats exist, from three generations of services:

    2026-10-15T08:00:01Z [ERROR] payments: card declined user=42 amount=1999
    time=2026-10-15T08:00:02Z level=warn service=search msg="slow query" took_ms=812
    {"ts": "2026-10-15T08:00:03Z", "lvl": "info", "svc": "auth", "msg": "login", "user": 42}
"""
import json


def parse_line(line):
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


def summarize(lines):
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
        record = parse_line(line)
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
