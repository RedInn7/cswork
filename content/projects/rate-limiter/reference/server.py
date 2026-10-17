"""Reference token-bucket rate limiter (only for scripts/projects/verify.mjs). PORT env, default 8080."""
import json
import math
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

KEY = re.compile(r'^/limits/([A-Za-z0-9_.:-]{1,64})(/take)?$')
lock = threading.Lock()
buckets = {}  # key -> {capacity, refill_per_sec, tokens, at}


def refill(b, now):
    b['tokens'] = min(b['capacity'], b['tokens'] + (now - b['at']) * b['refill_per_sec'])
    b['at'] = now


def number(value, minimum, integer=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if integer and not isinstance(value, int):
        return None
    return value if value >= minimum and math.isfinite(value) else None


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

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if not n:
            return {}
        try:
            value = json.loads(self.rfile.read(n))
        except ValueError:
            return None
        return value if isinstance(value, dict) else None

    def route(self, method):
        m = KEY.match(self.path)
        if not m:
            return self.reply(404, {'error': 'not found'})
        key, take = m.group(1), bool(m.group(2))
        body = self.body() if method in ('PUT', 'POST') else {}
        if body is None:
            return self.reply(400, {'error': 'body must be a JSON object'})
        now = time.monotonic()
        with lock:
            if method == 'PUT' and not take:
                capacity = number(body.get('capacity'), 1, integer=True)
                rate = number(body.get('refill_per_sec'), 0)
                if capacity is None or rate is None or rate == 0:
                    return self.reply(400, {'error': 'capacity (int >= 1) and refill_per_sec (> 0) are required'})
                buckets[key] = {'capacity': capacity, 'refill_per_sec': rate, 'tokens': capacity, 'at': now}
                return self.reply(200, {'key': key, 'capacity': capacity, 'refill_per_sec': rate})
            b = buckets.get(key)
            if b is None:
                return self.reply(404, {'error': 'no such limit'})
            if method == 'GET' and not take:
                refill(b, now)
                return self.reply(200, {'key': key, 'capacity': b['capacity'], 'refill_per_sec': b['refill_per_sec'], 'tokens': math.floor(b['tokens'])})
            if method == 'DELETE' and not take:
                del buckets[key]
                return self.reply(204)
            if method == 'POST' and take:
                tokens = number(body.get('tokens', 1), 1, integer=True)
                if tokens is None or tokens > b['capacity']:
                    return self.reply(400, {'error': 'tokens must be an int between 1 and capacity'})
                refill(b, now)
                if b['tokens'] >= tokens:
                    b['tokens'] -= tokens
                    return self.reply(200, {'allowed': True, 'remaining': math.floor(b['tokens'])})
                wait = (tokens - b['tokens']) / b['refill_per_sec']
                return self.reply(
                    429,
                    {'allowed': False, 'remaining': math.floor(b['tokens']), 'retry_after_ms': max(1, math.ceil(wait * 1000))},
                    {'Retry-After': str(max(1, math.ceil(wait)))},
                )
        return self.reply(405, {'error': 'method not allowed'})

    def do_GET(self):
        self.route('GET')

    def do_PUT(self):
        self.route('PUT')

    def do_POST(self):
        self.route('POST')

    def do_DELETE(self):
        self.route('DELETE')

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    ThreadingHTTPServer.request_queue_size = 128
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('PORT', '8080'))), Handler).serve_forever()
