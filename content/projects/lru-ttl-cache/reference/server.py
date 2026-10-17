"""Reference LRU cache with TTL (only for scripts/projects/verify.mjs). PORT and CAPACITY env."""
import json
import os
import re
import threading
import time
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

CAPACITY = int(os.environ.get('CAPACITY', '100'))
MAX_VALUE = 1 << 20
KEY = re.compile(r'^/cache/([A-Za-z0-9_.:-]{1,128})$')
lock = threading.Lock()
entries = OrderedDict()  # key -> (value, expires_at or None); last = most recently used
stats = {'hits': 0, 'misses': 0, 'evictions': 0}


def live(key, now):
    entry = entries.get(key)
    if entry and entry[1] is not None and entry[1] <= now:
        del entries[key]
        return None
    return entry


def purge(now):
    # ponytail: O(n) scan, fine for verification; the brief asks learners for a min-heap on expiry.
    for key in [k for k, (_, at) in entries.items() if at is not None and at <= now]:
        del entries[key]


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, data=b'', kind='application/json'):
        self.send_response(status)
        if data:
            self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def error(self, status, message):
        self.reply(status, json.dumps({'error': message}).encode())

    def do_GET(self):
        url = urlsplit(self.path)
        now = time.monotonic()
        with lock:
            if url.path == '/stats':
                purge(now)
                return self.reply(200, json.dumps({**stats, 'size': len(entries), 'capacity': CAPACITY}).encode())
            m = KEY.match(url.path)
            if not m:
                return self.error(404, 'not found')
            entry = live(m.group(1), now)
            if entry is None:
                stats['misses'] += 1
                return self.error(404, 'miss')
            stats['hits'] += 1
            entries.move_to_end(m.group(1))
            self.reply(200, entry[0], 'application/octet-stream')

    def do_PUT(self):
        url = urlsplit(self.path)
        m = KEY.match(url.path)
        if not m:
            return self.error(404, 'not found')
        ttl = parse_qs(url.query).get('ttl_ms', [None])[0]
        if ttl is not None and not (re.fullmatch(r'\d{1,10}', ttl) and int(ttl) >= 1):
            return self.error(400, 'ttl_ms must be a positive integer')
        length = int(self.headers.get('Content-Length') or 0)
        if length > MAX_VALUE:
            self.rfile.read(length)  # drained, so the client reads the 413 instead of a broken pipe
            return self.error(413, 'value too large')
        value = self.rfile.read(length)
        now = time.monotonic()
        with lock:
            key = m.group(1)
            if live(key, now) is None and len(entries) >= CAPACITY:
                purge(now)
                if len(entries) >= CAPACITY:
                    entries.popitem(last=False)
                    stats['evictions'] += 1
            entries[key] = (value, now + int(ttl) / 1000 if ttl else None)
            entries.move_to_end(key)
        self.reply(204)

    def do_DELETE(self):
        m = KEY.match(urlsplit(self.path).path)
        if not m:
            return self.error(404, 'not found')
        with lock:
            if live(m.group(1), time.monotonic()) is None:
                return self.error(404, 'no such key')
            del entries[m.group(1)]
        self.reply(204)

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    ThreadingHTTPServer.request_queue_size = 128
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('PORT', '8080'))), Handler).serve_forever()
