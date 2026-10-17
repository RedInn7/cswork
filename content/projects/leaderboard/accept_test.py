#!/usr/bin/env python3
"""Acceptance test: leaderboard service (https://cswork.org/projects/leaderboard).

Start your service, then run:
    BASE_URL=http://127.0.0.1:8080 python3 accept_test.py
Standard library only. Each check uses a fresh board with a random name, so reruns against the
same server are fine. Exit code 0 means every check passed.
"""
import json
import os
import random
import string
import sys
import threading
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
    return 'b' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))


def submit(board, player, score):
    status, body = call('POST', f'/boards/{board}/scores', {'player': player, 'score': score})
    assert status == 200, f'submitting {player}={score} answered {status}'
    return body


def expected(best):
    """The board as the brief defines it: score high to low, ties by name; rank = 1 + strictly higher scores."""
    order = sorted(best.items(), key=lambda kv: (-kv[1], kv[0]))
    return [{'player': p, 'score': s, 'rank': 1 + sum(1 for v in best.values() if v > s)} for p, s in order]


CHECKS = []


def check(fn):
    CHECKS.append(fn)
    return fn


@check
def submits_and_reads():
    """POST a score, then GET the player with their score and rank"""
    b = fresh()
    assert submit(b, 'ada', 50) == {'player': 'ada', 'score': 50, 'rank': 1}
    submit(b, 'bob', 70)
    assert call('GET', f'/boards/{b}/players/ada') == (200, {'player': 'ada', 'score': 50, 'rank': 2})


@check
def keeps_the_best_score():
    """a lower score never replaces a player's best"""
    b = fresh()
    submit(b, 'ada', 90)
    assert submit(b, 'ada', 40)['score'] == 90
    assert submit(b, 'ada', 95)['score'] == 95


@check
def rejects_bad_input():
    """400 for a missing player, a bad name, a negative, fractional or string score, or non-JSON"""
    b = fresh()
    for body in ({'score': 1}, {'player': 'a b', 'score': 1}, {'player': 'x' * 33, 'score': 1},
                 {'player': 'ada', 'score': -1}, {'player': 'ada', 'score': 1.5}, {'player': 'ada', 'score': '7'}):
        status, _ = call('POST', f'/boards/{b}/scores', body)
        assert status == 400, f'{body} answered {status}'
    assert call('POST', f'/boards/{b}/scores', raw=b'nope')[0] == 400
    assert call('GET', f'/boards/{b}/top?limit=0')[0] == 400
    assert call('GET', f'/boards/{b}/top?limit=101')[0] == 400


@check
def ties_share_a_rank():
    """ties order by name and share a rank; the next rank skips (1, 2, 2, 4)"""
    b = fresh()
    for player, score in (('cat', 80), ('bob', 80), ('ada', 100), ('dan', 10)):
        submit(b, player, score)
    status, body = call('GET', f'/boards/{b}/top')
    assert status == 200 and body['total'] == 4, (status, body)
    assert [(e['player'], e['rank']) for e in body['items']] == [('ada', 1), ('bob', 2), ('cat', 2), ('dan', 4)], body


@check
def pages_the_top_list():
    """top?limit=&offset= pages through the whole board"""
    b = fresh()
    best = {f'p{i:02d}': (i * 37) % 23 for i in range(30)}
    for p, s in best.items():
        submit(b, p, s)
    want = expected(best)
    got = []
    for offset in range(0, 30, 7):
        status, body = call('GET', f'/boards/{b}/top?limit=7&offset={offset}')
        assert status == 200 and body['total'] == 30, (status, body)
        got += body['items']
    assert got == want, 'pages do not add up to the whole board in order'
    assert call('GET', f'/boards/{b}/top?offset=40')[1]['items'] == []


@check
def neighbours_around_a_player():
    """players/<p>/around?radius=r lists r places either side, clipped at the ends"""
    b = fresh()
    best = {f'p{i}': 100 - i for i in range(8)}
    for p, s in best.items():
        submit(b, p, s)
    status, body = call('GET', f'/boards/{b}/players/p4/around?radius=2')
    assert status == 200 and [e['player'] for e in body['items']] == ['p2', 'p3', 'p4', 'p5', 'p6'], body
    assert [e['player'] for e in call('GET', f'/boards/{b}/players/p0/around?radius=2')[1]['items']] == ['p0', 'p1', 'p2']
    assert [e['player'] for e in call('GET', f'/boards/{b}/players/p7/around?radius=1')[1]['items']] == ['p6', 'p7']


@check
def unknown_and_deleted_players():
    """unknown players are 404; deleting one moves the ranks below it up"""
    b = fresh()
    submit(b, 'ada', 3)
    submit(b, 'bob', 2)
    assert call('GET', f'/boards/{b}/players/zed')[0] == 404
    assert call('DELETE', f'/boards/{b}/players/ada')[0] in (200, 204)
    assert call('GET', f'/boards/{b}/players/ada')[0] == 404
    assert call('GET', f'/boards/{b}/players/bob')[1]['rank'] == 1


@check
def matches_a_model_on_random_data():
    """600 random submissions: every rank and the whole order match a brute-force model"""
    b = fresh()
    rng = random.Random(7)
    best = {}
    for _ in range(600):
        p, s = f'u{rng.randrange(150)}', rng.randrange(60)
        submit(b, p, s)
        best[p] = max(best.get(p, -1), s)
    want = expected(best)
    got = []
    for offset in range(0, len(want), 100):
        got += call('GET', f'/boards/{b}/top?limit=100&offset={offset}')[1]['items']
    assert got == want, 'the order or ranks differ from the model'
    for e in rng.sample(want, 20):
        assert call('GET', f'/boards/{b}/players/{e["player"]}')[1] == e, e


@check
def concurrent_submissions_keep_the_max():
    """40 concurrent submissions for one player: the best one wins, nothing is lost"""
    b = fresh()
    scores = random.sample(range(1000), 40)
    gate = threading.Barrier(40)

    def hit(s):
        gate.wait()
        submit(b, 'ada', s)
        submit(b, f'q{s}', s)

    threads = [threading.Thread(target=hit, args=(s,)) for s in scores]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert call('GET', f'/boards/{b}/players/ada')[1]['score'] == max(scores)
    assert call('GET', f'/boards/{b}/top')[1]['total'] == 41


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
