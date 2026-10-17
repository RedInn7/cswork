"""Reference log search with an inverted index (only for scripts/projects/verify.mjs). PORT env."""
import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

LEVELS = ['debug', 'info', 'warn', 'error']
TOKEN = re.compile(r'[a-z0-9]+')
lock = threading.Lock()
logs = []  # id - 1 -> entry
index = {}  # token -> [ids], ascending


def tokens(text):
    return TOKEN.findall(text.lower())


def parse_query(q):
    """'a "b c" d-e' -> [['a'], ['b', 'c'], ['d', 'e']]: every group must appear as consecutive tokens."""
    groups = [tokens(m.group(1) or m.group(2)) for m in re.finditer(r'"([^"]*)"|(\S+)', q)]
    return [g for g in groups if g]


def has_phrase(words, group):
    n = len(group)
    return any(words[i:i + n] == group for i in range(len(words) - n + 1))


def valid(entry):
    return (isinstance(entry, dict) and set(entry) == {'ts', 'level', 'service', 'msg'}
            and isinstance(entry['ts'], int) and not isinstance(entry['ts'], bool) and entry['ts'] >= 0
            and entry['level'] in LEVELS and isinstance(entry['service'], str) and 0 < len(entry['service']) <= 64
            and isinstance(entry['msg'], str) and len(entry['msg']) <= 10_000)


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path != '/logs':
            return self.reply(404, {'error': 'not found'})
        raw = self.rfile.read(int(self.headers.get('Content-Length') or 0)).decode('utf-8', 'replace')
        batch = []
        for n, line in enumerate(raw.splitlines(), 1):
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
            except ValueError:
                entry = None
            if not valid(entry):
                return self.reply(400, {'error': 'invalid log line', 'line': n})
            batch.append(entry)
        with lock:
            for entry in batch:
                logs.append({'id': len(logs) + 1, **entry, 'words': tokens(entry['msg'])})
                for word in set(logs[-1]['words']):
                    index.setdefault(word, []).append(len(logs))
        self.reply(200, {'ingested': len(batch)})

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path != '/search':
            return self.reply(404, {'error': 'not found'})
        p = {k: v[0] for k, v in parse_qs(url.query).items()}
        try:
            limit = int(p.get('limit', '50'))
            low = int(p['from']) if 'from' in p else None
            high = int(p['to']) if 'to' in p else None
            after = tuple(int(x) for x in p['cursor'].split('.')) if p.get('cursor') else None
            if not 1 <= limit <= 500 or ('level' in p and p['level'] not in LEVELS) or (after and len(after) != 2):
                raise ValueError
        except ValueError:
            return self.reply(400, {'error': 'invalid parameter'})
        groups = parse_query(p.get('q', ''))
        with lock:
            if groups:
                # The rarest token's posting list first; every other must contain the id too.
                words = sorted({w for g in groups for w in g}, key=lambda w: len(index.get(w, [])))
                ids = set(index.get(words[0], []))
                for w in words[1:]:
                    ids &= set(index.get(w, []))
                candidates = [logs[i - 1] for i in ids]
            else:
                candidates = logs
            minimum = LEVELS.index(p['level']) if 'level' in p else 0
            hits = [e for e in candidates
                    if LEVELS.index(e['level']) >= minimum
                    and ('service' not in p or e['service'] == p['service'])
                    and (low is None or e['ts'] >= low) and (high is None or e['ts'] < high)
                    and all(has_phrase(e['words'], g) for g in groups if len(g) > 1)]
        hits.sort(key=lambda e: (e['ts'], e['id']), reverse=True)
        total = len(hits)
        if after:
            hits = [e for e in hits if (e['ts'], e['id']) < after]
        page = hits[:limit]
        last = page[-1] if page and len(hits) > limit else None
        self.reply(200, {
            'total': total,
            'items': [{k: e[k] for k in ('id', 'ts', 'level', 'service', 'msg')} for e in page],
            'next': f"{last['ts']}.{last['id']}" if last else None,
        })

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    ThreadingHTTPServer.request_queue_size = 128
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('PORT', '8080'))), Handler).serve_forever()
