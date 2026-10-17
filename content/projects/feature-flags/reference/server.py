"""Reference feature flag service (only for scripts/projects/verify.mjs). PORT env, default 8080."""
import hashlib
import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

PATH = re.compile(r'^/flags/([a-z0-9][a-z0-9_.-]{0,63})(/evaluate)?$')
ATTRIBUTE = re.compile(r'^[a-z_]{1,32}$')
lock = threading.Lock()
flags = {}


def valid(body):
    if not isinstance(body, dict) or set(body) - {'enabled', 'rollout', 'rules'}:
        return None
    enabled, rollout, rules = body.get('enabled'), body.get('rollout'), body.get('rules', [])
    if not isinstance(enabled, bool) or isinstance(rollout, bool) or not isinstance(rollout, int) or not 0 <= rollout <= 100:
        return None
    if not isinstance(rules, list) or len(rules) > 50:
        return None
    for rule in rules:
        if not (isinstance(rule, dict) and set(rule) == {'attribute', 'in', 'serve'}
                and isinstance(rule['attribute'], str) and ATTRIBUTE.match(rule['attribute']) and rule['attribute'] != 'user'
                and isinstance(rule['in'], list) and 0 < len(rule['in']) <= 100 and all(isinstance(v, str) for v in rule['in'])
                and isinstance(rule['serve'], bool)):
            return None
    return {'enabled': enabled, 'rollout': rollout, 'rules': rules}


def bucket(key, user):
    """0 <= bucket < 100, stable per (flag, user); a user on at rollout r stays on at any higher r."""
    return int(hashlib.sha256(f'{key}:{user}'.encode()).hexdigest()[:8], 16) % 10000 / 100


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body=None, headers=None):
        data = b'' if body is None else json.dumps(body).encode()
        self.send_response(status)
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        if body is not None:
            self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def target(self):
        url = urlsplit(self.path)
        m = PATH.match(url.path)
        return (m.group(1), bool(m.group(2)), parse_qs(url.query)) if m else (None, False, {})

    def do_PUT(self):
        key, evaluate, _ = self.target()
        if not key or evaluate:
            return self.reply(404, {'error': 'not found'})
        try:
            body = valid(json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'null'))
        except ValueError:
            body = None
        if body is None:
            return self.reply(400, {'error': 'expected {enabled, rollout, rules}'})
        with lock:
            current = flags.get(key)
            version = current['version'] if current else 0
            match = self.headers.get('If-Match')
            if match is not None and match.strip('"') != str(version):
                return self.reply(412, {'error': 'version changed', 'version': version})
            flags[key] = {'key': key, **body, 'version': version + 1}
            flag = flags[key]
        self.reply(200, flag, {'ETag': f'"{flag["version"]}"'})

    def do_GET(self):
        key, evaluate, query = self.target()
        if not key:
            return self.reply(404, {'error': 'not found'})
        with lock:
            flag = flags.get(key)
        if flag is None:
            return self.reply(404, {'error': 'no such flag'})
        if not evaluate:
            return self.reply(200, flag, {'ETag': f'"{flag["version"]}"'})
        user = query.get('user', [''])[0]
        if not user:
            return self.reply(400, {'error': 'user is required'})
        if not flag['enabled']:
            on, reason = False, 'disabled'
        else:
            hit = next((i for i, r in enumerate(flag['rules']) if query.get(r['attribute'], [None])[0] in r['in']), None)
            if hit is not None:
                on, reason = flag['rules'][hit]['serve'], f'rule:{hit}'
            else:
                on, reason = bucket(key, user) < flag['rollout'], 'rollout'
        self.reply(200, {'flag': key, 'on': on, 'reason': reason, 'version': flag['version']})

    def do_DELETE(self):
        key, evaluate, _ = self.target()
        with lock:
            if not key or evaluate or flags.pop(key, None) is None:
                return self.reply(404, {'error': 'no such flag'})
        self.reply(204)

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    ThreadingHTTPServer.request_queue_size = 128
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('PORT', '8080'))), Handler).serve_forever()
