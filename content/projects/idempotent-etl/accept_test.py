#!/usr/bin/env python3
"""Acceptance test: idempotent ETL pipeline CLI (https://cswork.org/projects/idempotent-etl).

Tell it how to start your program, then run:
    CMD="python3 etl.py" python3 accept_test.py
It runs `$CMD --input <dir> --db <file>` on generated CSV files in a temporary directory and reads
the SQLite result with the standard sqlite3 module. Standard library only. Exit code 0 means every
check passed.
"""
import csv
import os
import random
import re
import shlex
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

CMD = shlex.split(os.environ.get('CMD', ''))
WORK = Path(tempfile.mkdtemp(prefix='etl-accept-'))
INPUT, DB = WORK / 'in', WORK / 'out.sqlite'
HEADER = ['order_id', 'customer', 'amount', 'currency', 'status', 'updated_at']
rng = random.Random(11)


def run(timeout=120):
    result = subprocess.run(CMD + ['--input', str(INPUT), '--db', str(DB)], capture_output=True, text=True, timeout=timeout)
    assert result.returncode == 0, f'exit {result.returncode}: {result.stderr.strip()[-300:]}'


def write(name, rows, header=HEADER):
    with open(INPUT / name, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def stamp(day, second):
    return f'2026-03-{day:02d}T{second // 3600:02d}:{second // 60 % 60:02d}:{second % 60:02d}Z'


def order_row(i, day=None, second=None, status=None):
    return [f'ord-{i}', rng.choice(['Ada Lovelace', 'Smith, Jane', 'Li "Leo" Wang', 'Zoë']),
            rng.choice(['12', '0.5', '19.99', '100.10', '7.05']), rng.choice(['usd', 'EUR', ' cny ']),
            status or rng.choice(['created', 'paid', 'Shipped', 'cancelled']),
            stamp(day or rng.randint(1, 5), second if second is not None else rng.randrange(86400))]


def model():
    """The brief's rules over every CSV in INPUT, by brute force."""
    orders, rejects = {}, set()
    for path in sorted(INPUT.glob('*.csv')):
        with open(path, newline='', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            if [h.strip() for h in next(reader, [])] != HEADER:
                rejects.add((path.name, 1))
                continue
            for row in reader:
                if not row:
                    continue
                v = [x.strip() for x in row]
                ok = len(v) == 6 and re.fullmatch(r'[A-Za-z0-9-]{1,40}', v[0]) and 0 < len(v[1]) <= 200 \
                    and re.fullmatch(r'\d{1,12}(\.\d{1,2})?', v[2]) and re.fullmatch(r'[A-Z]{3}', v[3].upper()) \
                    and v[4].lower() in ('created', 'paid', 'shipped', 'cancelled') and re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ', v[5])
                if ok:
                    try:
                        datetime.strptime(v[5], '%Y-%m-%dT%H:%M:%SZ')
                    except ValueError:
                        ok = False
                if not ok:
                    rejects.add((path.name, reader.line_num))
                    continue
                whole, _, frac = v[2].partition('.')
                order = (v[0], v[1], int(whole) * 100 + int(frac.ljust(2, '0') or 0), v[3].upper(), v[4].lower(), v[5])
                if v[0] not in orders or order[5] > orders[v[0]][5]:
                    orders[v[0]] = order
    totals = {}
    for o in orders.values():
        if o[4] != 'cancelled':
            n, s = totals.get((o[5][:10], o[3]), (0, 0))
            totals[(o[5][:10], o[3])] = (n + 1, s + o[2])
    return {'orders': sorted(orders.values()), 'rejects': sorted(rejects),
            'daily_totals': sorted((d, c, n, s) for (d, c), (n, s) in totals.items())}


def dump():
    db = sqlite3.connect(DB)
    try:
        return {'orders': sorted(db.execute('SELECT order_id,customer,amount_cents,currency,status,updated_at FROM orders')),
                'rejects': sorted(db.execute('SELECT file,line FROM rejects')),
                'daily_totals': sorted(db.execute('SELECT day,currency,orders,amount_cents FROM daily_totals'))}
    finally:
        db.close()


def same(got, want):
    for table in want:
        assert got[table] == want[table], f'{table} differs: {len(got[table])} rows, expected {len(want[table])}; ' \
            f'first difference: {next(((g, w) for g, w in zip(got[table], want[table]) if g != w), "row count")}'


CHECKS = []


def check(fn):
    CHECKS.append(fn)
    return fn


@check
def first_load():
    """the first run loads valid rows, normalizes them and builds daily totals"""
    INPUT.mkdir()
    write('10-orders.csv', [order_row(i) for i in range(400)])
    run()
    same(dump(), model())


@check
def rerun_changes_nothing():
    """running again on the same input leaves every table exactly the same"""
    before = dump()
    run()
    run()
    assert dump() == before


@check
def newer_updates_win():
    """a later file updates an order only when its updated_at is strictly newer"""
    rows = []
    for i in range(0, 400, 3):
        rows.append(order_row(i, day=6, second=100, status='shipped'))  # newer than anything so far
    for i in range(1, 400, 3):
        rows.append(order_row(i, day=1, second=0, status='cancelled'))  # older or equal: ignored
    write('20-updates.csv', rows)
    run()
    same(dump(), model())


@check
def late_old_file_is_ignored():
    """a stale file that sorts first changes nothing it should not"""
    write('00-late.csv', [order_row(i, day=1, second=5, status='cancelled') for i in range(0, 400, 2)])
    run()
    same(dump(), model())


@check
def bad_rows_are_rejected():
    """bad rows land in rejects with their file and line number, and the good ones still load"""
    rows = [order_row(500), ['ord-501', 'Ann', '12.345', 'USD', 'paid', stamp(2, 1)], ['ord-502', 'Ann', '-1', 'USD', 'paid', stamp(2, 1)],
            ['ord-503', 'Ann', 'abc', 'USD', 'paid', stamp(2, 1)], ['ord-504', 'Ann', '1', 'US', 'paid', stamp(2, 1)],
            ['ord-505', 'Ann', '1', 'USD', 'lost', stamp(2, 1)], ['ord-506', 'Ann', '1', 'USD', 'paid', '2026-02-30T00:00:00Z'],
            ['', 'Ann', '1', 'USD', 'paid', stamp(2, 1)], ['ord-508', '  ', '1', 'USD', 'paid', stamp(2, 1)],
            ['ord-509', 'Ann', '1', 'USD', 'paid'], ['ord 510', 'Ann', '1', 'USD', 'paid', stamp(2, 1)], order_row(511)]
    write('30-mixed.csv', rows)
    run()
    got = dump()
    same(got, model())
    assert [line for f, line in got['rejects'] if f == '30-mixed.csv'] == list(range(3, 13)), got['rejects']


@check
def bad_header_skips_the_file():
    """a file whose header is wrong is one reject at line 1, and the other files still load"""
    write('40-wrong.csv', [order_row(600)], header=['id', 'customer', 'amount', 'currency', 'status', 'updated_at'])
    run()
    got = dump()
    same(got, model())
    assert ('40-wrong.csv', 1) in got['rejects'] and not any(o[0] == 'ord-600' for o in got['orders'])


@check
def crash_leaves_old_or_new_state():
    """killed partway through a big file, the database holds the old state or the new one, never a mix"""
    before = dump()
    write('50-big.csv', [order_row(1000 + i % 60000, day=7, second=i % 86400, status='paid') for i in range(150_000)])
    after = model()
    saved = WORK / 'before.sqlite'
    shutil.copy(DB, saved)
    start = time.monotonic()
    run()  # one uninterrupted run, timed, so each kill below lands inside a run
    full = time.monotonic() - start
    same(dump(), after)
    killed = 0
    for share in (0.9, 0.6, 0.3):  # each from the old state again; the last kill is the likeliest to land
        for leftover in WORK.glob(DB.name + '-*'):  # a -wal, -shm or -journal of the previous run
            leftover.unlink()
        shutil.copy(saved, DB)
        proc = subprocess.Popen(CMD + ['--input', str(INPUT), '--db', str(DB)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(full * share)
        proc.kill()  # SIGKILL on POSIX, TerminateProcess on Windows; nothing if it already exited
        if proc.wait() == 0:
            continue  # it finished before the kill
        killed += 1
        state = dump()
        assert state == before or state == after, f'a partial run is visible after a kill at {share:.0%} of a run'
    assert killed, f'every run finished before the kill, so nothing was interrupted (a full run took {full:.2f} s)'
    run()  # and the next run after a kill ends as an uninterrupted one
    same(dump(), after)


@check
def missing_input_fails():
    """a missing input directory exits non-zero"""
    result = subprocess.run(CMD + ['--input', str(WORK / 'nope'), '--db', str(WORK / 'other.sqlite')], capture_output=True, timeout=60)
    assert result.returncode != 0


def main():
    if not CMD:
        sys.exit('Set CMD to the command that starts your program, for example CMD="python3 etl.py".')
    failed = 0
    for fn in CHECKS:
        try:
            fn()
            print(f'PASS  {fn.__doc__}')
        except Exception as e:  # an assertion, a crash or a timeout
            failed += 1
            print(f'FAIL  {fn.__doc__}\n      {type(e).__name__}: {e}')
    print(f'\n{len(CHECKS) - failed}/{len(CHECKS)} checks passed' + (f'  (files kept in {WORK})' if failed else ''))
    if not failed:
        shutil.rmtree(WORK, ignore_errors=True)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
