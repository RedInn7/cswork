#!/usr/bin/env python3
"""Acceptance test: log search with an inverted index (https://cswork.org/projects/log-search).

Start your service, then run:
    BASE_URL=http://127.0.0.1:8080 python3 accept_test.py
Standard library only. It ingests about 3,000 generated lines, each carrying this run's own
token and service name, and compares every search with a brute-force model, so reruns against
the same server are fine. Exit code 0 means every check passed.
"""
import json
import os
import random
import re
import string
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8080').rstrip('/')
RUN = 'run' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
LEVELS = ['debug', 'info', 'warn', 'error']
WORDS = ('timeout db connection reset user login failed cache miss disk full retry upstream payment '
         'order shipped queue lag slow query gc pause node down up ok').split()
rng = random.Random(2024)
LOGS = []  # this run's entries in ingestion order


def call(method, path, data=None):
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={'Content-Type': 'application/x-ndjson'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            status, text = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read()
    return status, (json.loads(text) if text.strip() else None)


def ingest(entries):
    data = '\n'.join(json.dumps(e) for e in entries).encode()
    status, body = call('POST', '/logs', data)
    assert status == 200 and body['ingested'] == len(entries), (status, body)
    LOGS.extend(entries)


def search(**params):
    status, body = call('GET', '/search?' + urllib.parse.urlencode(params))
    assert status == 200, f'search {params} answered {status}: {body}'
    return body


def model(q='', level=None, service=None, low=None, high=None):
    """The brief's rules, by brute force: AND of terms, quoted or hyphenated terms as phrases."""
    tokens = lambda s: re.findall(r'[a-z0-9]+', s.lower())
    groups = [g for g in (tokens(a or b) for a, b in re.findall(r'"([^"]*)"|(\S+)', q)) if g]
    def phrase(words, g):
        return any(words[i:i + len(g)] == g for i in range(len(words) - len(g) + 1))
    hits = [(e['ts'], i, e) for i, e in enumerate(LOGS)
            if all(phrase(tokens(e['msg']), g) for g in groups)
            and (level is None or LEVELS.index(e['level']) >= LEVELS.index(level))
            and (service is None or e['service'] == service)
            and (low is None or e['ts'] >= low) and (high is None or e['ts'] < high)]
    return [e for _, _, e in sorted(hits, key=lambda h: (h[0], h[1]), reverse=True)]


def strip(items):
    return [{k: e[k] for k in ('ts', 'level', 'service', 'msg')} for e in items]


def everything(**params):
    """Walks every page of a search with ?cursor=."""
    items, cursor, pages = [], None, 0
    while True:
        body = search(**params, **({'cursor': cursor} if cursor else {}))
        items += body['items']
        cursor, pages = body['next'], pages + 1
        if not cursor:
            return body['total'], strip(items)
        assert pages < 2000, 'the cursor never ends'


def generate(n, start):
    out = []
    for i in range(n):
        words = rng.choices(WORDS, k=rng.randint(3, 9))
        if rng.random() < 0.3:
            words.insert(rng.randrange(len(words) + 1), 'connection reset')
        if rng.random() < 0.2:
            words.append(f'host-{rng.randint(1, 4)}')
        words.insert(rng.randrange(len(words) + 1), RUN)
        out.append({'ts': start + i // 2 * 10, 'level': rng.choice(LEVELS),  # pairs share a timestamp
                    'service': rng.choice([f'{RUN}-api', f'{RUN}-web', f'{RUN}-worker']),
                    'msg': ' '.join(words).capitalize() + rng.choice(['', '.', '!', ' (code=503)'])})
    return out


CHECKS = []


def check(fn):
    CHECKS.append(fn)
    return fn


@check
def ingests_batches():
    """POST /logs takes newline-delimited JSON and reports how many lines it stored"""
    start = 1_700_000_000_000
    for b in range(6):
        ingest(generate(500, start + b * 2500))


@check
def rejects_a_bad_batch_whole():
    """a batch with one invalid line is a 400 naming the line, and none of it is stored"""
    good = {'ts': 5, 'level': 'info', 'service': f'{RUN}-bad', 'msg': f'{RUN} poison'}
    for bad in ({**good, 'level': 'fatal'}, {**good, 'ts': 'x'}, {'ts': 5, 'level': 'info', 'msg': 'no service'}):
        data = (json.dumps(good) + '\n' + json.dumps(bad)).encode()
        status, body = call('POST', '/logs', data)
        assert status == 400 and body.get('line') == 2, (status, body)
    assert call('POST', '/logs', b'{"ts": 1,')[0] == 400
    assert search(q=f'{RUN} poison')['total'] == 0, 'nothing from a rejected batch may be stored'


@check
def single_terms():
    """one-word searches match whole tokens, case-insensitively"""
    for word in ('timeout', 'DISK', 'gc', 'up'):
        body = search(q=f'{RUN} {word}', limit=500)
        want = model(f'{RUN} {word}')
        assert body['total'] == len(want) and strip(body['items']) == want[:500], word
    assert search(q=f'{RUN} tim')['total'] == 0, 'a prefix is not a token'


@check
def terms_are_anded():
    """several terms must all be present"""
    for q in ('timeout db', 'user login failed', 'cache miss slow'):
        assert everything(q=f'{RUN} {q}', limit=100) == (len(model(f'{RUN} {q}')), model(f'{RUN} {q}')), q


@check
def phrases():
    """a quoted phrase, or a hyphenated word, matches consecutive tokens only"""
    for q in ('"connection reset"', '"reset connection"', 'host-3', '"code 503"'):
        want = model(f'{RUN} {q}')
        assert everything(q=f'{RUN} {q}', limit=200) == (len(want), want), q
    assert len(model(f'{RUN} "connection reset"')) < len(model(f'{RUN} connection reset')), 'the data must tell them apart'


@check
def filters():
    """level is a minimum, service is exact, from is inclusive and to exclusive"""
    lo, hi = LOGS[700]['ts'], LOGS[2300]['ts']
    cases = [dict(level='warn'), dict(level='error', service=f'{RUN}-api'), dict(low=lo, high=hi), dict(q=f'{RUN} retry', level='info', low=lo)]
    for case in cases:
        params = {'q': case.get('q', RUN), 'limit': 500}
        for key, name in (('level', 'level'), ('service', 'service'), ('low', 'from'), ('high', 'to')):
            if key in case:
                params[name] = case[key]
        want = model(**{'q': RUN, **case})
        assert everything(**params) == (len(want), want), case


@check
def newest_first_with_cursor():
    """results are newest first (same timestamp: last ingested first) and the cursor walks them all"""
    want = model(f'{RUN} db')
    total, got = everything(q=f'{RUN} db', limit=7)
    assert total == len(want) and got == want


@check
def rejects_bad_parameters():
    """400 for a limit outside 1-500, an unknown level or a non-numeric from"""
    for params in ({'limit': 0}, {'limit': 501}, {'level': 'fatal'}, {'from': 'yesterday'}):
        assert call('GET', '/search?' + urllib.parse.urlencode({'q': RUN, **params}))[0] == 400, params


def main():
    failed = 0
    for fn in CHECKS:
        try:
            fn()
            print(f'PASS  {fn.__doc__}')
        except Exception as e:  # an assertion, or the service not answering
            failed += 1
            print(f'FAIL  {fn.__doc__}\n      {type(e).__name__}: {e}')
    print(f'\n{len(CHECKS) - failed}/{len(CHECKS)} checks passed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
