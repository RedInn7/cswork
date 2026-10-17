#!/usr/bin/env python3
"""Acceptance test: key-value store with a write-ahead log and compaction (https://cswork.org/projects/kv-wal).

Tell it how to start your store, then run:
    CMD="python3 kv.py" python3 accept_test.py
It runs `$CMD --dir <folder>` with commands on standard input, one per line, reading one reply
line per command, and kills it hard (SIGKILL, or TerminateProcess on Windows) to check what
survives. Standard library only. Exit code 0 means every check passed.
"""
import os
import random
import shlex
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

CMD = shlex.split(os.environ.get('CMD', ''))
WORK = Path(tempfile.mkdtemp(prefix='kv-accept-'))


class Store:
    def __init__(self, folder):
        self.proc = subprocess.Popen(CMD + ['--dir', str(folder)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.DEVNULL, text=True, encoding='utf-8', bufsize=1)

    def __call__(self, line):
        self.proc.stdin.write(line + '\n')
        self.proc.stdin.flush()
        reply = self.proc.stdout.readline()
        assert reply, f'no reply to {line[:40]!r}: the process exited'
        return reply.rstrip('\n')

    def close(self):
        self.proc.stdin.close()
        assert self.proc.wait(timeout=30) == 0, 'exit code must be 0 at end of input'

    def kill(self):
        self.proc.kill()  # SIGKILL on POSIX, TerminateProcess on Windows
        self.proc.wait()


def folder(name):
    path = WORK / name
    path.mkdir()
    return path


def size(path):
    return sum(f.stat().st_size for f in path.rglob('*') if f.is_file())


CHECKS = []


def check(fn):
    CHECKS.append(fn)
    return fn


@check
def basic_commands():
    """SET, GET, DEL and errors answer one line each"""
    kv = Store(folder('basic'))
    assert kv('GET a') == '(nil)'
    assert kv('SET a hello world') == 'OK'
    assert kv('GET a') == 'hello world', 'the value is the rest of the line, spaces included'
    assert kv('SET a 你好 ✓') == 'OK' and kv('GET a') == '你好 ✓'
    assert kv('DEL a') == '1' and kv('DEL a') == '0' and kv('GET a') == '(nil)'
    for bad in ('FLY a', 'SET onlykey', 'GET', 'DEL'):
        assert kv(bad).startswith('ERR'), bad
    kv.close()


@check
def survives_restart():
    """data written before a clean exit is there after a restart, deletes included"""
    path = folder('restart')
    kv = Store(path)
    for i in range(200):
        kv(f'SET k{i} v{i}')
    for i in range(0, 200, 3):
        kv(f'DEL k{i}')
    kv('SET k1 changed')
    kv.close()
    kv = Store(path)
    for i in range(200):
        want = '(nil)' if i % 3 == 0 else ('changed' if i == 1 else f'v{i}')
        assert kv(f'GET k{i}') == want, i
    kv.close()


@check
def acknowledged_writes_survive_kill():
    """after SIGKILL, every SET that answered OK is there, and nothing is half-written"""
    path = folder('crash')
    kv = Store(path)
    acked = []
    stop = threading.Event()
    value = lambda i: f'value-{i}-' + 'x' * (i % 300)

    def writer():
        try:
            for i in range(100_000):
                if stop.is_set():
                    return
                kv.proc.stdin.write(f'SET key{i} {value(i)}\n')
                kv.proc.stdin.flush()
        except (BrokenPipeError, ValueError):
            pass

    def reader():
        for line in kv.proc.stdout:
            if line.strip() == 'OK':
                acked.append(len(acked))

    threads = [threading.Thread(target=writer), threading.Thread(target=reader)]
    for t in threads:
        t.start()
    time.sleep(0.5)
    kv.kill()
    stop.set()
    for t in threads:
        t.join()
    assert acked, 'no write was acknowledged in 0.5 s'
    kv = Store(path)
    for i in acked:
        assert kv(f'GET key{i}') == value(i), f'acknowledged key{i} is missing or wrong'
    for i in range(len(acked), len(acked) + 50):
        assert kv(f'GET key{i}') in ('(nil)', value(i)), f'key{i} holds garbage'
    assert kv('SET after crash') == 'OK'
    kv.close()
    kv = Store(path)
    assert kv('GET after') == 'crash', 'writes after recovering from a torn tail must survive too'
    assert kv(f'GET key{acked[-1]}') == value(acked[-1])
    kv.close()


@check
def torn_tail_is_ignored():
    """junk at the end of the newest file (a torn write) is ignored, and later writes still survive"""
    path = folder('torn')
    kv = Store(path)
    for i in range(100):
        kv(f'SET t{i} {i}')
    kv.close()
    newest = max((f for f in path.rglob('*') if f.is_file()), key=lambda f: f.stat().st_mtime_ns)
    with open(newest, 'ab') as f:
        f.write(bytes([0x00, 0x00, 0x01, 0x07, 0x9c, 0x53, 0x45, 0x54]))  # the start of a record that never finished
    kv = Store(path)
    assert all(kv(f'GET t{i}') == str(i) for i in range(100)), 'data before the torn tail was lost'
    assert kv('SET fresh 1') == 'OK'
    kv.close()
    kv = Store(path)
    assert kv('GET fresh') == '1' and kv('GET t99') == '99', 'a write after the torn tail was lost'
    kv.close()


@check
def compaction_shrinks_the_log():
    """COMPACT after many overwrites shrinks the folder and keeps every value"""
    path = folder('compact')
    kv = Store(path)
    for i in range(300):
        kv(f'SET hot {i:04d}' + 'y' * 2000)
    for i in range(50):
        kv(f'SET cold{i} {i}')
    for i in range(0, 50, 2):
        kv(f'DEL cold{i}')
    before = size(path)
    assert before > 500_000, f'the folder holds only {before} bytes after 600 KB of writes'
    assert kv('COMPACT') == 'OK'
    after = size(path)
    assert after < 100_000, f'{after} bytes after COMPACT'
    assert kv('GET hot') == '0299' + 'y' * 2000
    kv.close()
    kv = Store(path)
    assert kv('GET hot') == '0299' + 'y' * 2000
    for i in range(50):
        assert kv(f'GET cold{i}') == ('(nil)' if i % 2 == 0 else str(i)), f'cold{i} after compaction and restart'
    assert kv('DEL cold1') == '1'
    kv.close()
    kv = Store(path)
    assert kv('GET cold1') == '(nil)', 'a delete after compaction must survive a restart'
    kv.close()


@check
def kill_during_compaction():
    """SIGKILL at any moment of a COMPACT loses nothing"""
    path = folder('compact-crash')
    want = {f'c{i}': f'{i}-' + 'z' * 500 for i in range(400)}
    kv = Store(path)
    for k, v in want.items():
        kv(f'SET {k} {v}')
        kv(f'SET {k} {v}')
    kv.close()
    rng = random.Random(5)
    for round_ in range(6):
        kv = Store(path)
        kv('GET c0')  # started and recovered
        kv.proc.stdin.write('COMPACT\n')
        kv.proc.stdin.flush()
        time.sleep(rng.random() * 0.05)
        kv.kill()
        kv = Store(path)
        for k in rng.sample(sorted(want), 40) + ['c0', 'c399']:
            assert kv(f'GET {k}') == want[k], f'{k} lost after a kill during COMPACT (round {round_ + 1})'
        kv.close()


def main():
    if not CMD:
        sys.exit('Set CMD to the command that starts your store, for example CMD="python3 kv.py".')
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
