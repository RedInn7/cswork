"""Reference polite crawler (only for scripts/projects/verify.mjs): cli.py START_URL --max-pages N --delay-ms D."""
import argparse
import json
import time
import urllib.error
import urllib.request
import urllib.robotparser
from collections import deque
from html.parser import HTMLParser
from urllib.parse import urldefrag, urljoin, urlsplit

AGENT = 'cswork-bot/1.0'


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.found = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.found += [v for k, v in attrs if k == 'href' and v]


class Polite:
    def __init__(self, delay):
        self.delay, self.last = delay, 0.0

    def get(self, url):
        """(status, headers, body) after waiting out the delay; retries 429/503 per Retry-After, 3 tries."""
        for attempt in range(3):
            wait = self.last + self.delay - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': AGENT}), timeout=10) as r:
                    return r.status, r.headers, r.read()
            except urllib.error.HTTPError as e:
                if e.code in (429, 503) and attempt < 2:
                    time.sleep(min(int(e.headers.get('Retry-After') or 1), 30))
                    continue
                return e.code, e.headers, b''
            except OSError:
                return 0, {}, b''
            finally:
                # Counted from the end of a request: a slow response never shortens the pause.
                self.last = time.monotonic()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('start')
    parser.add_argument('--max-pages', type=int, default=100)
    parser.add_argument('--delay-ms', type=int, default=1000)
    args = parser.parse_args()
    site = urlsplit(args.start)
    client = Polite(args.delay_ms / 1000)
    robots = urllib.robotparser.RobotFileParser()
    status, _, body = client.get(f'{site.scheme}://{site.netloc}/robots.txt')
    robots.parse(body.decode('utf-8', 'replace').splitlines() if status == 200 else [])
    start = urldefrag(args.start)[0]
    queue, seen, fetched = deque([(start, 0)]), {start}, 0
    while queue and fetched < args.max_pages:
        url, depth = queue.popleft()
        if not robots.can_fetch(AGENT, url):
            continue
        status, headers, body = client.get(url)
        fetched += 1
        print(json.dumps({'url': url, 'status': status, 'depth': depth}), flush=True)
        if status != 200 or 'text/html' not in (headers.get('Content-Type') or ''):
            continue
        links = Links()
        links.feed(body.decode('utf-8', 'replace'))
        for href in links.found:
            target = urldefrag(urljoin(url, href))[0]
            parts = urlsplit(target)
            if parts.scheme in ('http', 'https') and parts.netloc == site.netloc and target not in seen:
                seen.add(target)
                queue.append((target, depth + 1))


if __name__ == '__main__':
    main()
