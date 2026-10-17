#!/usr/bin/env python3
"""Acceptance test: feature flag service (https://cswork.org/projects/feature-flags).

Start your service, then run:
    BASE_URL=http://127.0.0.1:8080 python3 accept_test.py
Standard library only. Flag keys carry a random suffix, so reruns against the same server are
fine. The rollout checks are statistical with wide margins (4 standard deviations) on 600
users. Exit code 0 means every check passed.
"""
import json
import os
import random
import string
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8080').rstrip('/')
RUN = ''.join(random.choices(string.ascii_lowercase, k=6))
USERS = [f'user-{i}' for i in range(600)]


def call(method, path, body=None, headers=None, raw=None):
    data = raw if raw is not None else (None if body is None else json.dumps(body).encode())
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            status, head, text = r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        status, head, text = e.code, e.headers, e.read()
    return status, head, (json.loads(text) if text.strip() else None)


def flag(name, enabled=True, rollout=0, rules=()):
    key = f'{name}-{RUN}'
    status, _, body = call('PUT', f'/flags/{key}', {'enabled': enabled, 'rollout': rollout, 'rules': list(rules)})
    assert status == 200, f'PUT /flags/{key} answered {status}: {body}'
    return key


def evaluate(key, user, **attributes):
    status, _, body = call('GET', f'/flags/{key}/evaluate?' + urllib.parse.urlencode({'user': user, **attributes}))
    assert status == 200, f'evaluate {key} for {user} answered {status}'
    return body


def on_users(key):
    return {u for u in USERS if evaluate(key, u)['on']}


CHECKS = []


def check(fn):
    CHECKS.append(fn)
    return fn


@check
def creates_and_reads():
    """PUT creates a flag at version 1; GET returns it with an ETag"""
    key = f'create-{RUN}'
    rules = [{'attribute': 'country', 'in': ['US'], 'serve': True}]
    status, head, body = call('PUT', f'/flags/{key}', {'enabled': True, 'rollout': 25, 'rules': rules})
    assert status == 200 and body['version'] == 1, (status, body)
    status, head, body = call('GET', f'/flags/{key}')
    assert status == 200 and body['rollout'] == 25 and body['rules'] == rules and body['version'] == 1, body
    assert head['ETag'].strip('"') == '1', head['ETag']


@check
def optimistic_concurrency():
    """each PUT bumps the version; If-Match with a stale version is 412 and changes nothing"""
    key = flag('version', rollout=10)
    status, _, body = call('PUT', f'/flags/{key}', {'enabled': True, 'rollout': 20}, {'If-Match': '"1"'})
    assert status == 200 and body['version'] == 2, (status, body)
    status, _, _ = call('PUT', f'/flags/{key}', {'enabled': True, 'rollout': 90}, {'If-Match': '"1"'})
    assert status == 412, f'a stale If-Match answered {status}'
    assert call('GET', f'/flags/{key}')[2]['rollout'] == 20


@check
def rejects_bad_flags():
    """400 for a missing or non-boolean enabled, a rollout outside 0-100, or a malformed rule"""
    key = f'bad-{RUN}'
    for body in ({'rollout': 5}, {'enabled': 'yes', 'rollout': 5}, {'enabled': True, 'rollout': 101},
                 {'enabled': True, 'rollout': 12.5}, {'enabled': True, 'rollout': 5, 'rules': [{'attribute': 'country', 'in': []}]},
                 {'enabled': True, 'rollout': 5, 'rules': [{'attribute': 'country', 'in': 'US', 'serve': True}]}):
        assert call('PUT', f'/flags/{key}', body)[0] == 400, body
    assert call('PUT', f'/flags/{key}', raw=b'{')[0] == 400


@check
def evaluate_errors():
    """evaluating an unknown flag is 404; without ?user= it is 400"""
    assert call('GET', f'/flags/nope-{RUN}/evaluate?user=a')[0] == 404
    key = flag('nouser', rollout=50)
    assert call('GET', f'/flags/{key}/evaluate')[0] == 400


@check
def disabled_is_off():
    """a disabled flag is off for everyone, reason "disabled", even when a rule matches"""
    key = flag('off', enabled=False, rollout=100, rules=[{'attribute': 'country', 'in': ['US'], 'serve': True}])
    body = evaluate(key, 'ada', country='US')
    assert body['on'] is False and body['reason'] == 'disabled', body


@check
def first_matching_rule_wins():
    """rules run in order and the first match serves its value, reason rule:<index>"""
    key = flag('rules', rollout=100, rules=[
        {'attribute': 'plan', 'in': ['free'], 'serve': False},
        {'attribute': 'country', 'in': ['US', 'CA'], 'serve': True},
    ])
    assert evaluate(key, 'a', plan='free', country='US') == {'flag': key, 'on': False, 'reason': 'rule:0', 'version': 1}
    body = evaluate(key, 'a', plan='pro', country='CA')
    assert body['on'] is True and body['reason'] == 'rule:1', body
    body = evaluate(key, 'a', country='FR')
    assert body['on'] is True and body['reason'] == 'rollout', body


@check
def rollout_extremes():
    """rollout 0 is off and 100 is on for every user"""
    zero, full = flag('zero', rollout=0), flag('full', rollout=100)
    for u in USERS[:50]:
        assert evaluate(zero, u)['on'] is False and evaluate(full, u)['on'] is True, u


@check
def sticky_per_user():
    """the same user always gets the same answer"""
    key = flag('sticky', rollout=50)
    first = {u: evaluate(key, u)['on'] for u in USERS[:60]}
    for _ in range(2):
        assert {u: evaluate(key, u)['on'] for u in USERS[:60]} == first


@check
def rollout_share():
    """rollout 30 turns the flag on for about 30% of users (22.5-37.5%)"""
    share = len(on_users(flag('share', rollout=30))) / len(USERS)
    assert 0.225 <= share <= 0.375, f'{share:.1%} on'


@check
def raising_rollout_keeps_users_on():
    """raising rollout from 30 to 60 keeps every user who was on, and reaches about 60%"""
    key = flag('grow', rollout=30)
    before = on_users(key)
    flag('grow', rollout=60)
    after = on_users(key)
    assert before <= after, f'{len(before - after)} users were switched off'
    assert 0.52 <= len(after) / len(USERS) <= 0.68, f'{len(after) / len(USERS):.1%} on'


@check
def flags_bucket_independently():
    """two flags at 50% pick different users: about a quarter are on in both (18-32%)"""
    a, b = on_users(flag('ind-a', rollout=50)), on_users(flag('ind-b', rollout=50))
    both = len(a & b) / len(USERS)
    assert 0.18 <= both <= 0.32, f'{both:.1%} on in both: the bucket must depend on the flag key'


@check
def deletes():
    """DELETE removes the flag"""
    key = flag('gone', rollout=50)
    assert call('DELETE', f'/flags/{key}')[0] in (200, 204)
    assert call('GET', f'/flags/{key}')[0] == 404
    assert call('GET', f'/flags/{key}/evaluate?user=a')[0] == 404


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
