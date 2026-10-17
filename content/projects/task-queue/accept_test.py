#!/usr/bin/env python3
"""Acceptance test: task queue with retries and visibility timeouts (https://cswork.org/projects/task-queue).

Start your service, then run:
    BASE_URL=http://127.0.0.1:8080 python3 accept_test.py
Standard library only. Every check uses its own queue with a random name, so reruns against the
same server are fine. Exit code 0 means every check passed.
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


def call(method, path, body=None, raw=None):
    data = raw if raw is not None else (None if body is None else json.dumps(body).encode())
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            status, text = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read()
    return status, (json.loads(text) if text.strip() else None)


def fresh():
    return 'q' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))


def send(q, body, **options):
    status, reply = call('POST', f'/queues/{q}/messages', {'body': body, **options})
    assert status in (200, 201), f'enqueue answered {status}: {reply}'
    return reply['id']


def receive(q, visibility_ms=30_000, max=1):
    status, reply = call('POST', f'/queues/{q}/receive', {'visibility_ms': visibility_ms, 'max': max})
    assert status == 200, f'receive answered {status}: {reply}'
    return reply['messages']


def ack(q, receipt):
    return call('POST', f'/queues/{q}/ack', {'receipt': receipt})[0]


CHECKS = []


def check(fn):
    CHECKS.append(fn)
    return fn


@check
def round_trip():
    """a message comes back once with its JSON body and attempt 1; after its ack the queue is empty"""
    q = fresh()
    body = {'task': 'email', 'to': [1, 2], 'ok': True}
    mid = send(q, body)
    [m] = receive(q)
    assert m['id'] == mid and m['body'] == body and m['attempt'] == 1, m
    assert receive(q) == [], 'an in-flight message must stay hidden'
    assert ack(q, m['receipt']) in (200, 204)
    assert call('GET', f'/queues/{q}/stats')[1] == {'ready': 0, 'delayed': 0, 'in_flight': 0, 'dead': 0}


@check
def fifo():
    """messages come out in the order they went in, up to max at a time"""
    q = fresh()
    ids = [send(q, i) for i in range(6)]
    got = receive(q, max=4) + receive(q, max=4)
    assert [m['id'] for m in got] == ids and [m['body'] for m in got] == list(range(6)), got


@check
def redelivers_after_visibility_timeout():
    """an unacked message is delivered again after its visibility timeout, with a new receipt and attempt 2"""
    q = fresh()
    send(q, 'x')
    [first] = receive(q, visibility_ms=300)
    time.sleep(0.15)
    assert receive(q) == [], 'still hidden before the timeout'
    time.sleep(0.3)
    [again] = receive(q, visibility_ms=10_000)
    assert again['id'] == first['id'] and again['attempt'] == 2, again
    assert again['receipt'] != first['receipt']
    assert ack(q, first['receipt']) == 409, 'the old receipt must no longer work'
    assert ack(q, again['receipt']) in (200, 204)


@check
def late_or_bogus_acks():
    """an ack after the visibility timeout, a second ack and a made-up receipt are all 409"""
    q = fresh()
    send(q, 'late')
    [m] = receive(q, visibility_ms=150)
    time.sleep(0.3)
    assert ack(q, m['receipt']) == 409
    [m] = receive(q)
    assert ack(q, m['receipt']) in (200, 204)
    assert ack(q, m['receipt']) == 409
    assert ack(q, 'no-such-receipt') == 409


@check
def dead_letters_after_max_attempts():
    """after max_attempts deliveries without an ack the message moves to the dead-letter list"""
    q = fresh()
    mid = send(q, {'n': 1}, max_attempts=2)
    for attempt in (1, 2):
        [m] = receive(q, visibility_ms=150)
        assert m['attempt'] == attempt, m
        time.sleep(0.3)
    assert receive(q) == [], 'no third delivery'
    status, dead = call('GET', f'/queues/{q}/dead')
    assert status == 200 and dead['messages'] == [{'id': mid, 'body': {'n': 1}, 'attempts': 2}], dead
    assert call('GET', f'/queues/{q}/stats')[1]['dead'] == 1


@check
def nack_retries_with_delay():
    """nack makes a message visible again at once, or after delay_ms; it counts as an attempt"""
    q = fresh()
    send(q, 'retry', max_attempts=3)
    [m] = receive(q)
    assert call('POST', f'/queues/{q}/nack', {'receipt': m['receipt']})[0] in (200, 204)
    [m] = receive(q)
    assert m['attempt'] == 2, m
    assert call('POST', f'/queues/{q}/nack', {'receipt': m['receipt'], 'delay_ms': 300})[0] in (200, 204)
    assert receive(q) == [], 'hidden during the delay'
    assert call('GET', f'/queues/{q}/stats')[1]['delayed'] == 1
    time.sleep(0.4)
    [m] = receive(q)
    assert m['attempt'] == 3
    assert call('POST', f'/queues/{q}/nack', {'receipt': m['receipt']})[0] in (200, 204)
    assert receive(q) == [] and len(call('GET', f'/queues/{q}/dead')[1]['messages']) == 1, 'the last nack dead-letters it'


@check
def delayed_messages():
    """delay_ms on enqueue hides a message until it is due"""
    q = fresh()
    send(q, 'later', delay_ms=300)
    send(q, 'now')
    assert [m['body'] for m in receive(q, max=10)] == ['now']
    time.sleep(0.4)
    assert [m['body'] for m in receive(q, max=10)] == ['later']


@check
def rejects_bad_requests():
    """400 for a missing body, max_attempts or max out of range, a bad visibility or non-JSON"""
    q = fresh()
    for path, body in (('messages', {}), ('messages', {'body': 1, 'max_attempts': 0}), ('messages', {'body': 1, 'max_attempts': 21}),
                       ('messages', {'body': 1, 'delay_ms': -1}), ('receive', {'visibility_ms': 0}), ('receive', {'max': 11})):
        assert call('POST', f'/queues/{q}/{path}', body)[0] == 400, (path, body)
    assert call('POST', f'/queues/{q}/messages', raw=b'[')[0] == 400


@check
def competing_consumers():
    """12 workers drain 60 messages: each is delivered exactly once"""
    q = fresh()
    for i in range(60):
        send(q, i)
    seen, lock = [], threading.Lock()

    def worker():
        while True:
            got = receive(q, max=3)
            if not got:
                return
            for m in got:
                assert ack(q, m['receipt']) in (200, 204)
                with lock:
                    seen.append(m['body'])

    threads = [threading.Thread(target=worker) for _ in range(12)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(seen) == list(range(60)), f'{len(seen)} deliveries for 60 messages'


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
