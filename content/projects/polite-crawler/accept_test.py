#!/usr/bin/env python3
"""Acceptance test: polite web crawler (https://cswork.org/projects/polite-crawler).

Tell it how to start your crawler, then run:
    CMD="python3 crawler.py" python3 accept_test.py
It starts two small local web sites, runs `$CMD <start url> --max-pages N --delay-ms D`, and checks
what your crawler printed and every request the sites received. Standard library only. Exit code
0 means every check passed.
"""
import json
import os
import shlex
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CMD = shlex.split(os.environ.get('CMD', ''))
DELAY_MS = 150
ROBOTS = """User-agent: *
Disallow: /

User-agent: cswork-bot
Allow: /secret/public
Disallow: /secret
"""


def html(*links):
    return '<!doctype html><title>t</title><body>' + ''.join(f'<p><a href="{h}">link</a></p>' for h in links)


class Site:
    """A local site that records every request: (monotonic time, path, user agent)."""

    def __init__(self, pages):
        self.pages, self.requests, self.busy = pages, [], 0
        site = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                site.requests.append((time.monotonic(), self.path, self.headers.get('User-Agent') or ''))
                if self.path == '/busy':
                    site.busy += 1
                    if site.busy == 1:
                        return self.send(429, 'text/plain', 'slow down', {'Retry-After': '1'})
                page = site.pages.get(self.path)
                if page is None:
                    return self.send(404, 'text/plain', 'not found')
                self.send(200, *page)

            def send(self, status, kind, body, headers=None):
                data = body.encode()
                self.send_response(status)
                self.send_header('Content-Type', kind)
                for k, v in (headers or {}).items():
                    self.send_header(k, v)
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.url = f'http://127.0.0.1:{self.server.server_address[1]}'
        threading.Thread(target=self.server.serve_forever, daemon=True).start()


OTHER = Site({'/ext': ('text/html', html('/'))})
SITE = Site({
    '/robots.txt': ('text/plain', ROBOTS),
    '/': ('text/html', html('/a', '/b', '/a#top', '/private/x', '/secret/hidden', '/secret/public/ok',
                            f'{OTHER.url}/ext', 'mailto:team@example.com', 'javascript:void(0)', '/data.json',
                            '/busy', '/missing', '?q=1')),
    '/a': ('text/html', html('b', '/c', '/', '#again')),
    '/b': ('text/html', html('/a', '/c?page=2')),
    '/c': ('text/html', html('d')),
    '/c?page=2': ('text/html', html('/c')),
    '/d': ('text/html', html('/e')),
    '/e': ('text/html', html()),
    '/?q=1': ('text/html', html('/')),
    '/private/x': ('text/html', html()),
    '/secret/public/ok': ('text/html', html()),
    '/secret/hidden': ('text/html', html('/never')),
    '/data.json': ('application/json', '{"note": "<a href=\\"/trap\\">not a link</a>"}'),
    '/busy': ('text/html', html('/f')),
    '/f': ('text/html', html()),
})
EXPECTED = {'/': 200, '/a': 200, '/b': 200, '/private/x': 200, '/secret/public/ok': 200, '/data.json': 200, '/busy': 200,
            '/missing': 404, '/?q=1': 200, '/c': 200, '/c?page=2': 200, '/d': 200, '/e': 200, '/f': 200}
RESULT = {}


def crawl(max_pages):
    SITE.requests.clear()
    OTHER.requests.clear()
    SITE.busy = 0
    out = subprocess.run(CMD + [SITE.url + '/', '--max-pages', str(max_pages), '--delay-ms', str(DELAY_MS)],
                         capture_output=True, text=True, timeout=90)
    assert out.returncode == 0, f'exit {out.returncode}: {out.stderr.strip()[-300:]}'
    lines = [json.loads(line) for line in out.stdout.splitlines() if line.startswith('{')]
    return lines, list(SITE.requests), list(OTHER.requests)


def path(url):
    assert url.startswith(SITE.url), url
    return url[len(SITE.url):] or '/'


CHECKS = []


def check(fn):
    CHECKS.append(fn)
    return fn


@check
def crawls_the_site():
    """prints one JSON line per page fetched, with its final status, and finds every allowed page"""
    lines, requests, other = crawl(100)
    RESULT.update(lines=lines, requests=requests, other=other)
    got = {path(line['url']): line['status'] for line in lines}
    assert len(got) == len(lines), 'a page was printed twice'
    assert got == EXPECTED, f'missing {sorted(set(EXPECTED) - set(got))}, extra {sorted(set(got) - set(EXPECTED))}, ' \
        f'statuses {[(p, s) for p, s in got.items() if EXPECTED.get(p) not in (None, s)]}'


@check
def depth_is_link_distance():
    """depth counts links from the start page (breadth first)"""
    depths = {path(line['url']): line['depth'] for line in RESULT['lines']}
    assert depths['/'] == 0 and depths['/a'] == 1 and depths['/c'] == 2 and depths['/d'] == 3 and depths['/e'] == 4 and depths['/f'] == 2, depths


@check
def reads_robots_first_with_its_agent():
    """fetches /robots.txt before anything else and identifies itself as cswork-bot"""
    requests = RESULT['requests']
    assert requests and requests[0][1] == '/robots.txt', [r[1] for r in requests[:3]]
    assert all('cswork-bot' in agent for _, _, agent in requests), {agent for _, _, agent in requests}


@check
def obeys_robots():
    """uses the cswork-bot group: /secret is off limits except /secret/public"""
    paths = [p for _, p, _ in RESULT['requests']]
    assert '/secret/hidden' not in paths and '/never' not in paths, 'fetched a disallowed page'


@check
def stays_on_the_site():
    """never requests another host, a mailto: link, or a link inside a non-HTML file"""
    other = RESULT['other']
    assert other == [], f'requested {[p for _, p, _ in other]} on another host'
    assert '/trap' not in [p for _, p, _ in RESULT['requests']], 'parsed links out of a JSON file'


@check
def fetches_each_page_once():
    """each URL is requested once (fragments dropped), except the retried /busy"""
    paths = [p for _, p, _ in RESULT['requests']]
    repeats = {p for p in paths if paths.count(p) > (2 if p == '/busy' else 1)}
    assert not repeats, f'requested more than once: {sorted(repeats)}'


@check
def waits_between_requests():
    """leaves at least delay-ms between requests, and honours Retry-After on a 429"""
    times = [t for t, _, _ in RESULT['requests']]
    gaps = [b - a for a, b in zip(times, times[1:])]
    # Timed where the site receives them, so allow a little jitter.
    assert min(gaps) >= DELAY_MS / 1000 * 0.8, f'two requests {min(gaps) * 1000:.0f} ms apart'
    busy = [t for t, p, _ in RESULT['requests'] if p == '/busy']
    assert len(busy) == 2 and busy[1] - busy[0] >= 0.95, 'retry /busy once, after the 1 s Retry-After'


@check
def stops_at_max_pages():
    """--max-pages 3 fetches three pages in breadth-first order and nothing more"""
    lines, requests, _ = crawl(3)
    assert [line['depth'] for line in lines] == [0, 1, 1], lines
    pages = [p for _, p, _ in requests if p != '/robots.txt']
    assert len(pages) == 3, f'requested {pages}'


def main():
    if not CMD:
        sys.exit('Set CMD to the command that starts your crawler, for example CMD="python3 crawler.py".')
    failed = 0
    for fn in CHECKS:
        try:
            fn()
            print(f'PASS  {fn.__doc__}')
        except Exception as e:  # an assertion, a crash or a timeout
            failed += 1
            print(f'FAIL  {fn.__doc__}\n      {type(e).__name__}: {e}')
    print(f'\n{len(CHECKS) - failed}/{len(CHECKS)} checks passed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
