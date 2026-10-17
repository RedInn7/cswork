#!/usr/bin/env python3
"""Acceptance test: LRU cache service with TTL (https://cswork.org/projects/lru-ttl-cache).

Start your service (any capacity of at least 10; GET /stats reports it), then run:
    BASE_URL=http://127.0.0.1:8080 python3 accept_test.py
Standard library only. Keys carry a random prefix and counters are read as differences, so reruns
against the same server are fine. Exit code 0 means every check passed.
"""
import json
import os
import random
import string
import sys
import threading
import time
import urllib.error
import urllib.request

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8080').rstrip('/')
RUN = ''.join(random.choices(string.ascii_lowercase, k=6))


def call(method, path, data=None):
    req = urllib.request.Request(BASE + path, data=data, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def put(key, value, ttl_ms=None):
    status, _ = call('PUT', f'/cache/{RUN}-{key}' + (f'?ttl_ms={ttl_ms}' if ttl_ms else ''), value)
    assert status in (200, 201, 204), f'PUT {key} answered {status}'


def get(key):
    return call('GET', f'/cache/{RUN}-{key}')


def stats():
    status, body = call('GET', '/stats')
    assert status == 200, f'GET /stats answered {status}'
    return json.loads(body)


CHECKS = []


def check(fn):
    CHECKS.append(fn)
    return fn


@check
def stores_bytes_exactly():
    """PUT then GET returns the same bytes, binary included; a missing key is 404"""
    value = bytes(range(256)) * 3
    put('bin', value)
    assert get('bin') == (200, value)
    assert get('nothing')[0] == 404


@check
def overwrites():
    """PUT on an existing key replaces the value"""
    put('over', b'one')
    put('over', b'two')
    assert get('over') == (200, b'two')


@check
def deletes():
    """DELETE removes a key (204), and a second DELETE is 404"""
    put('del', b'x')
    assert call('DELETE', f'/cache/{RUN}-del')[0] in (200, 204)
    assert get('del')[0] == 404
    assert call('DELETE', f'/cache/{RUN}-del')[0] == 404


@check
def rejects_bad_requests():
    """400 for a bad ttl_ms; a value over 1 MiB is refused with 413 (or a closed connection)"""
    for ttl in ('0', '-5', 'abc', '1.5'):
        status, _ = call('PUT', f'/cache/{RUN}-bad?ttl_ms={ttl}', b'x')
        assert status == 400, f'ttl_ms={ttl} answered {status}'
    try:
        status, _ = call('PUT', f'/cache/{RUN}-big', b'x' * ((1 << 20) + 1))
    except (OSError, urllib.error.URLError):
        status = 'a closed connection'  # rejecting before reading the body is fine too
    assert status in (413, 'a closed connection'), f'1 MiB + 1 byte answered {status}'
    assert get('big')[0] == 404, 'the oversized value must not be stored'


@check
def expires_after_ttl():
    """a key with ttl_ms is a hit before it expires and a 404 after; a PUT without ttl keeps no TTL"""
    put('ttl', b'soon', ttl_ms=300)
    assert get('ttl') == (200, b'soon')
    time.sleep(0.45)
    assert get('ttl')[0] == 404
    put('ttl2', b'a', ttl_ms=200)
    put('ttl2', b'b')
    time.sleep(0.3)
    assert get('ttl2') == (200, b'b'), 'overwriting without ttl_ms should clear the old TTL'


@check
def counts_hits_and_misses():
    """/stats counts every GET as a hit or a miss"""
    put('count', b'1')
    before = stats()
    for _ in range(3):
        get('count')
    for _ in range(2):
        get('count-missing')
    after = stats()
    assert after['hits'] - before['hits'] == 3, (before, after)
    assert after['misses'] - before['misses'] == 2, (before, after)


@check
def evicts_least_recently_used():
    """when full, a new key evicts the least recently used one; a GET makes a key recent"""
    capacity = stats()['capacity']
    assert capacity >= 10, f'capacity {capacity}: run with at least 10'
    for i in range(capacity):
        put(f'lru{i}', str(i).encode())
    assert stats()['size'] == capacity
    get('lru0')  # lru1 is now the oldest
    before = stats()
    put('lru-new', b'new')
    after = stats()
    assert after['evictions'] - before['evictions'] == 1, (before, after)
    assert get('lru1')[0] == 404, 'lru1 was least recently used'
    assert get('lru0')[0] == 200 and get('lru-new')[0] == 200
    assert stats()['size'] == capacity


@check
def expired_entries_go_before_live_ones():
    """when full, an expired entry is dropped before any live key is evicted, and size counts live keys only"""
    capacity = stats()['capacity']
    put('exp-old', b'oldest')
    for i in range(capacity - 2):
        put(f'exp{i}', b'.')
    put('exp-short', b'short', ttl_ms=200)
    time.sleep(0.3)
    assert stats()['size'] == capacity - 1, 'the expired key must not count'
    before = stats()
    put('exp-new', b'new')
    after = stats()
    assert after['evictions'] == before['evictions'], 'removing an expired entry is not an eviction'
    assert get('exp-old') == (200, b'oldest'), 'the least recently used live key must survive'


@check
def survives_concurrent_clients():
    """40 clients writing and reading at once all get their own values back"""
    errors = []
    gate = threading.Barrier(40)

    def client(n):
        gate.wait()
        for j in range(5):
            put(f'c{n}-{j}', f'{n}:{j}'.encode())
            status, body = get(f'c{n}-{j}')
            if status != 200 or body != f'{n}:{j}'.encode():
                errors.append((n, j, status, body))

    threads = [threading.Thread(target=client, args=(n,)) for n in range(40)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    # With a small capacity a key may be evicted between its PUT and GET; anything else is a bug.
    capacity = stats()['capacity']
    wrong = [e for e in errors if not (e[2] == 404 and capacity < 200)]
    assert not wrong, wrong[:3]


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
