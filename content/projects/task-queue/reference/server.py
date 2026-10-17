"""Reference task queue with visibility timeouts (only for scripts/projects/verify.mjs). PORT env."""
import itertools
import json
import os
import re
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PATH = re.compile(r'^/queues/([A-Za-z0-9_-]{1,64})/(messages|receive|ack|nack|stats|dead)$')
lock = threading.Lock()
queues = {}  # name -> {seq: message}
seq = itertools.count()


def now_ms():
    return time.monotonic() * 1000


def sweep(q, now):
    """In-flight messages past their deadline become visible again, or dead after their last attempt."""
    for m in q.values():
        if m['state'] == 'in_flight' and m['deadline'] <= now:
            m['receipt'] = None
            m['state'] = 'dead' if m['attempts'] >= m['max_attempts'] else 'ready'
            m['visible_at'] = now


def integer(body, name, default, low, high):
    value = body.get(name, default)
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise ValueError(name)
    return value


def find(q, body):
    receipt = body.get('receipt')
    return next((m for m in q.values() if m['state'] == 'in_flight' and receipt and m['receipt'] == receipt), None)


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body=None):
        data = b'' if body is None else json.dumps(body).encode()
        self.send_response(status)
        if body is not None:
            self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_one(self, method):
        m = PATH.match(self.path)
        if not m:
            return self.reply(404, {'error': 'not found'})
        name, action = m.groups()
        if (action in ('stats', 'dead')) != (method == 'GET'):
            return self.reply(405, {'error': 'method not allowed'})
        body = {}
        if method == 'POST':
            try:
                body = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
            except ValueError:
                return self.reply(400, {'error': 'invalid JSON'})
            if not isinstance(body, dict):
                return self.reply(400, {'error': 'body must be an object'})
        try:
            with lock:
                q = queues.setdefault(name, {})
                now = now_ms()
                sweep(q, now)
                return getattr(self, action)(q, body, now)
        except ValueError as e:
            return self.reply(400, {'error': f'invalid {e}'})

    def messages(self, q, body, now):
        if 'body' not in body:
            raise ValueError('body')
        attempts = integer(body, 'max_attempts', 3, 1, 20)
        delay = integer(body, 'delay_ms', 0, 0, 3_600_000)
        n = next(seq)
        q[n] = {'id': f'm{n}', 'body': body['body'], 'max_attempts': attempts, 'attempts': 0,
                'state': 'ready', 'visible_at': now + delay, 'receipt': None, 'deadline': 0}
        self.reply(201, {'id': f'm{n}'})

    def receive(self, q, body, now):
        visibility = integer(body, 'visibility_ms', 30_000, 1, 3_600_000)
        count = integer(body, 'max', 1, 1, 10)
        out = []
        for n in sorted(q):
            m = q[n]
            if len(out) == count:
                break
            if m['state'] == 'ready' and m['visible_at'] <= now:
                m.update(state='in_flight', attempts=m['attempts'] + 1, receipt=secrets.token_hex(12), deadline=now + visibility)
                out.append({'id': m['id'], 'body': m['body'], 'receipt': m['receipt'], 'attempt': m['attempts']})
        self.reply(200, {'messages': out})

    def ack(self, q, body, now):
        m = find(q, body)
        if m is None:
            return self.reply(409, {'error': 'receipt is not in flight'})
        del q[next(n for n, x in q.items() if x is m)]
        self.reply(204)

    def nack(self, q, body, now):
        m = find(q, body)
        if m is None:
            return self.reply(409, {'error': 'receipt is not in flight'})
        delay = integer(body, 'delay_ms', 0, 0, 3_600_000)
        m.update(receipt=None, state='dead' if m['attempts'] >= m['max_attempts'] else 'ready', visible_at=now + delay)
        self.reply(204)

    def stats(self, q, body, now):
        count = lambda f: sum(1 for m in q.values() if f(m))
        self.reply(200, {
            'ready': count(lambda m: m['state'] == 'ready' and m['visible_at'] <= now),
            'delayed': count(lambda m: m['state'] == 'ready' and m['visible_at'] > now),
            'in_flight': count(lambda m: m['state'] == 'in_flight'),
            'dead': count(lambda m: m['state'] == 'dead'),
        })

    def dead(self, q, body, now):
        self.reply(200, {'messages': [{'id': m['id'], 'body': m['body'], 'attempts': m['attempts']}
                                      for n, m in sorted(q.items()) if m['state'] == 'dead']})

    def do_GET(self):
        self.handle_one('GET')

    def do_POST(self):
        self.handle_one('POST')

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    ThreadingHTTPServer.request_queue_size = 128
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('PORT', '8080'))), Handler).serve_forever()
