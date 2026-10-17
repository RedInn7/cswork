"""Reference leaderboard service (only for scripts/projects/verify.mjs). PORT env, default 8080."""
import bisect
import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

NAME = r'[A-Za-z0-9_-]{1,32}'
ROUTES = [
    ('POST', re.compile(rf'^/boards/({NAME})/scores$'), 'submit'),
    ('GET', re.compile(rf'^/boards/({NAME})/top$'), 'top'),
    ('GET', re.compile(rf'^/boards/({NAME})/players/({NAME})$'), 'player'),
    ('GET', re.compile(rf'^/boards/({NAME})/players/({NAME})/around$'), 'around'),
    ('DELETE', re.compile(rf'^/boards/({NAME})/players/({NAME})$'), 'delete'),
]
lock = threading.Lock()
boards = {}  # board -> {'best': {player: score}, 'order': sorted [(-score, player)]}


def board(name):
    return boards.setdefault(name, {'best': {}, 'order': []})


def rank(b, score):
    # Competition ranking: 1 + players with a strictly higher score.
    return bisect.bisect_left(b['order'], (-score, '')) + 1


def entry(b, player):
    score = b['best'][player]
    return {'player': player, 'score': score, 'rank': rank(b, score)}


def int_param(query, name, default, low, high):
    raw = query.get(name, [str(default)])[0]
    if not re.fullmatch(r'\d{1,6}', raw) or not low <= int(raw) <= high:
        raise ValueError(name)
    return int(raw)


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body=None):
        data = b'' if body is None else json.dumps(body).encode()
        self.send_response(status)
        if body is not None:
            self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def route(self, method):
        url = urlsplit(self.path)
        query = parse_qs(url.query)
        for m, pattern, name in ROUTES:
            match = pattern.match(url.path)
            if m == method and match:
                try:
                    with lock:
                        return getattr(self, name)(*match.groups(), query)
                except ValueError as e:
                    return self.reply(400, {'error': f'invalid {e}'})
        self.reply(404, {'error': 'not found'})

    def submit(self, name, query):
        try:
            body = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'null')
        except ValueError:
            raise ValueError('JSON')
        if not isinstance(body, dict):
            raise ValueError('body')
        player, score = body.get('player'), body.get('score')
        if not isinstance(player, str) or not re.fullmatch(NAME, player):
            raise ValueError('player')
        if isinstance(score, bool) or not isinstance(score, int) or not 0 <= score <= 10**12:
            raise ValueError('score')
        b = board(name)
        old = b['best'].get(player)
        if old is None or score > old:
            if old is not None:
                b['order'].pop(bisect.bisect_left(b['order'], (-old, player)))
            bisect.insort(b['order'], (-score, player))
            b['best'][player] = score
        self.reply(200, entry(b, player))

    def top(self, name, query):
        limit = int_param(query, 'limit', 10, 1, 100)
        offset = int_param(query, 'offset', 0, 0, 10**6)
        b = board(name)
        items = [entry(b, p) for _, p in b['order'][offset:offset + limit]]
        self.reply(200, {'total': len(b['order']), 'items': items})

    def player(self, name, player, query):
        b = board(name)
        if player not in b['best']:
            return self.reply(404, {'error': 'no such player'})
        self.reply(200, entry(b, player))

    def around(self, name, player, query):
        radius = int_param(query, 'radius', 2, 0, 50)
        b = board(name)
        if player not in b['best']:
            return self.reply(404, {'error': 'no such player'})
        at = bisect.bisect_left(b['order'], (-b['best'][player], player))
        window = b['order'][max(0, at - radius):at + radius + 1]
        self.reply(200, {'items': [entry(b, p) for _, p in window]})

    def delete(self, name, player, query):
        b = board(name)
        if player not in b['best']:
            return self.reply(404, {'error': 'no such player'})
        b['order'].pop(bisect.bisect_left(b['order'], (-b['best'].pop(player), player)))
        self.reply(204)

    def do_GET(self):
        self.route('GET')

    def do_POST(self):
        self.route('POST')

    def do_DELETE(self):
        self.route('DELETE')

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    ThreadingHTTPServer.request_queue_size = 128
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('PORT', '8080'))), Handler).serve_forever()
