#!/usr/bin/env python3
"""Acceptance test: token-bucket rate limiter service (https://cswork.org/projects/rate-limiter).

Start your service, then run:
    BASE_URL=http://127.0.0.1:8080 python3 accept_test.py
Standard library only. Every key it creates carries a random suffix, so reruns against the same
server are fine. Exit code 0 means every check passed.
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


def call(method, path, body=None, raw=None):
    data = raw if raw is not None else (None if body is None else json.dumps(body).encode())
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            status, headers, text = r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        status, headers, text = e.code, e.headers, e.read()
    return status, headers, (json.loads(text) if text.strip() else None)


def limit(name, capacity, rate):
    key = f'{name}-{RUN}'
    status, _, body = call('PUT', f'/limits/{key}', {'capacity': capacity, 'refill_per_sec': rate})
    assert status == 200, f'PUT /limits/{key} answered {status}'
    return key


def take(key, tokens=None):
    return call('POST', f'/limits/{key}/take', None if tokens is None else {'tokens': tokens})


CHECKS = []


def check(fn):
    CHECKS.append(fn)
    return fn


@check
def creates_a_limit():
    """PUT /limits/<key> stores the bucket and echoes its config"""
    key = f'create-{RUN}'
    status, _, body = call('PUT', f'/limits/{key}', {'capacity': 4, 'refill_per_sec': 0.5})
    assert status == 200, status
    assert body['capacity'] == 4 and body['refill_per_sec'] == 0.5, body
    status, _, body = call('GET', f'/limits/{key}')
    assert status == 200 and body['tokens'] == 4, (status, body)


@check
def rejects_bad_config():
    """bad configs answer 400: capacity 0, a missing or zero rate, a fractional capacity, not JSON"""
    key = f'bad-{RUN}'
    for body in ({'capacity': 0, 'refill_per_sec': 1}, {'capacity': 3}, {'capacity': 3, 'refill_per_sec': 0}, {'capacity': 2.5, 'refill_per_sec': 1}):
        status, _, _ = call('PUT', f'/limits/{key}', body)
        assert status == 400, f'{body} answered {status}'
    status, _, _ = call('PUT', f'/limits/{key}', raw=b'{not json')
    assert status == 400, f'invalid JSON answered {status}'


@check
def unknown_key():
    """taking from a key that was never configured answers 404"""
    status, _, _ = take(f'never-{RUN}')
    assert status == 404, status


@check
def burst_then_429():
    """a full bucket allows `capacity` requests at once, then 429 with Retry-After"""
    key = limit('burst', 3, 1)
    remaining = []
    for _ in range(3):
        status, _, body = take(key)
        assert status == 200 and body['allowed'] is True, (status, body)
        remaining.append(body['remaining'])
    assert remaining == [2, 1, 0], remaining
    status, headers, body = take(key)
    assert status == 429 and body['allowed'] is False, (status, body)
    assert int(headers['Retry-After']) >= 1, headers['Retry-After']
    assert 0 < body['retry_after_ms'] <= 1000, body


@check
def refills_over_time():
    """tokens come back at refill_per_sec"""
    key = limit('refill', 2, 5)
    take(key)
    take(key)
    assert take(key)[0] == 429
    time.sleep(0.3)  # 1.5 tokens
    assert take(key)[0] == 200, 'one token should be back after 0.3 s at 5/s'
    assert take(key)[0] == 429, 'only one whole token should be back'


@check
def never_above_capacity():
    """an idle bucket stops filling at its capacity"""
    key = limit('cap', 2, 50)
    time.sleep(0.3)  # would be 15 tokens without the cap
    assert [take(key)[0] for _ in range(3)] == [200, 200, 429]


@check
def takes_several_tokens():
    """{"tokens": n} takes n at once; more than the capacity is a 400"""
    key = limit('multi', 5, 0.01)
    status, _, body = take(key, 4)
    assert status == 200 and body['remaining'] == 1, (status, body)
    status, _, body = take(key, 2)
    assert status == 429 and body['remaining'] == 1, (status, body)
    assert take(key, 6)[0] == 400
    assert take(key, 0)[0] == 400


@check
def keys_are_independent():
    """draining one key leaves another untouched"""
    a, b = limit('a', 1, 0.01), limit('b', 1, 0.01)
    assert take(a)[0] == 200 and take(a)[0] == 429
    assert take(b)[0] == 200


@check
def reconfiguring_resets():
    """PUT on an existing key replaces its config and refills it"""
    key = limit('reset', 1, 0.01)
    take(key)
    assert take(key)[0] == 429
    limit('reset', 2, 0.01)
    assert [take(key)[0] for _ in range(3)] == [200, 200, 429]


@check
def concurrent_takes_are_atomic():
    """60 concurrent requests on a 25-token bucket: exactly 25 are allowed"""
    key = limit('race', 25, 0.001)
    results = []
    gate = threading.Barrier(60)

    def hit():
        gate.wait()
        results.append(take(key)[0])

    threads = [threading.Thread(target=hit) for _ in range(60)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert results.count(200) == 25 and results.count(429) == 35, sorted(results)


@check
def deletes_a_limit():
    """DELETE /limits/<key> removes it"""
    key = limit('gone', 1, 1)
    status, _, _ = call('DELETE', f'/limits/{key}')
    assert status in (200, 204), status
    assert call('GET', f'/limits/{key}')[0] == 404
    assert take(key)[0] == 404


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
