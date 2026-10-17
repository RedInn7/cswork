#!/usr/bin/env python3
"""Acceptance test: mini Redis speaking RESP (https://cswork.org/projects/mini-redis).

Start your server, then run:
    BASE_URL=tcp://127.0.0.1:6379 python3 accept_test.py
Standard library only (raw sockets). Keys carry a random prefix, so reruns against the same
server are fine. Exit code 0 means every check passed.
"""
import os
import random
import socket
import string
import sys
import threading
import time
from urllib.parse import urlsplit

ADDRESS = urlsplit(os.environ.get('BASE_URL', 'tcp://127.0.0.1:6379'))
RUN = ''.join(random.choices(string.ascii_lowercase, k=6))


def encode(*args):
    parts = [a if isinstance(a, bytes) else str(a).encode() for a in args]
    return b'*%d\r\n' % len(parts) + b''.join(b'$%d\r\n%s\r\n' % (len(p), p) for p in parts)


class Client:
    def __init__(self):
        self.sock = socket.create_connection((ADDRESS.hostname, ADDRESS.port or 6379), timeout=5)
        self.file = self.sock.makefile('rb')

    def reply(self):
        line = self.file.readline()
        assert line.endswith(b'\r\n'), f'reply {line!r} does not end with CRLF'
        kind, rest = line[:1], line[1:-2]
        if kind == b'+':
            return rest.decode()
        if kind == b'-':
            return Exception(rest.decode())
        if kind == b':':
            return int(rest)
        if kind == b'$':
            if rest == b'-1':
                return None
            data = self.file.read(int(rest) + 2)
            assert data.endswith(b'\r\n'), 'bulk string must end with CRLF'
            return data[:-2]
        if kind == b'*':
            return [self.reply() for _ in range(int(rest))]
        raise AssertionError(f'unknown reply type {line!r}')

    def __call__(self, *args):
        self.sock.sendall(encode(*args))
        return self.reply()

    def close(self):
        self.sock.close()


def key(name):
    return f'{RUN}:{name}'


def is_error(value):
    return isinstance(value, Exception) and str(value).startswith('ERR')


CHECKS = []


def check(fn):
    CHECKS.append(fn)
    return fn


@check
def ping_and_echo():
    """PING answers +PONG (or echoes its argument); ECHO returns a bulk string"""
    c = Client()
    assert c('PING') == 'PONG'
    assert c('PING', 'hi') == b'hi'
    assert c('ECHO', 'hello world') == b'hello world'
    assert c('ping') == 'PONG', 'command names are case-insensitive'


@check
def set_get_del_exists():
    """SET/GET/DEL/EXISTS, with a nil bulk string for a missing key"""
    c = Client()
    assert c('GET', key('nope')) is None
    assert c('SET', key('a'), 'one') == 'OK'
    assert c('GET', key('a')) == b'one'
    assert c('SET', key('b'), 'two') == 'OK'
    assert c('EXISTS', key('a'), key('b'), key('nope'), key('a')) == 3
    assert c('DEL', key('a'), key('b'), key('nope')) == 2
    assert c('GET', key('a')) is None


@check
def binary_safe_values():
    """values are binary safe: CRLF, NUL and 1 MB values come back intact"""
    c = Client()
    tricky = b'line1\r\nline2\x00\xff\r\n'
    assert c('SET', key('bin'), tricky) == 'OK' and c('GET', key('bin')) == tricky
    big = bytes(random.getrandbits(8) for _ in range(1 << 20))
    assert c('SET', key('big'), big) == 'OK' and c('GET', key('big')) == big


@check
def set_options():
    """SET ... NX and XX set only when the key is missing or present; otherwise a nil reply"""
    c = Client()
    assert c('SET', key('nx'), '1', 'NX') == 'OK'
    assert c('SET', key('nx'), '2', 'NX') is None and c('GET', key('nx')) == b'1'
    assert c('SET', key('xx'), '1', 'XX') is None and c('GET', key('xx')) is None
    assert c('SET', key('nx'), '3', 'xx') == 'OK' and c('GET', key('nx')) == b'3'


@check
def expiry():
    """SET PX/EX, EXPIRE and TTL: -2 missing, -1 no expiry, seconds left otherwise"""
    c = Client()
    assert c('SET', key('px'), 'v', 'PX', 300) == 'OK'
    assert c('GET', key('px')) == b'v'
    c('SET', key('ex'), 'v', 'EX', 100)
    assert c('TTL', key('ex')) in (99, 100)
    c('SET', key('plain'), 'v')
    assert c('TTL', key('plain')) == -1 and c('TTL', key('nope')) == -2
    assert c('EXPIRE', key('plain'), 1) == 1 and c('EXPIRE', key('nope'), 1) == 0
    time.sleep(0.45)
    assert c('GET', key('px')) is None and c('EXISTS', key('px')) == 0
    c('SET', key('ex'), 'w')
    assert c('TTL', key('ex')) == -1, 'a plain SET clears the expiry'
    time.sleep(0.7)
    assert c('GET', key('plain')) is None and c('TTL', key('plain')) == -2


@check
def incr():
    """INCR counts from 0, and refuses a value that is not an integer"""
    c = Client()
    assert c('INCR', key('n')) == 1 and c('INCR', key('n')) == 2
    c('SET', key('n'), '41')
    assert c('INCR', key('n')) == 42 and c('GET', key('n')) == b'42'
    c('SET', key('word'), 'abc')
    assert is_error(c('INCR', key('word')))
    c('SET', key('max'), str(2 ** 63 - 1))
    assert is_error(c('INCR', key('max'))), 'INCR past a signed 64-bit integer must fail'


@check
def errors_keep_the_connection():
    """an unknown command or a wrong argument count is an -ERR reply, and the connection keeps working"""
    c = Client()
    assert is_error(c('FLY', 'away'))
    assert is_error(c('GET'))
    assert is_error(c('SET', key('x')))
    assert is_error(c('SET', key('x'), 'v', 'PX', 'soon'))
    assert c('PING') == 'PONG'


@check
def pipelining():
    """100 commands sent in one write get 100 replies in order"""
    c = Client()
    batch = b''.join(encode('SET', key(f'p{i}'), i) + encode('GET', key(f'p{i}')) for i in range(50))
    c.sock.sendall(batch)
    replies = [c.reply() for _ in range(100)]
    assert replies == [r for i in range(50) for r in ('OK', str(i).encode())]


@check
def split_frames():
    """a command that arrives a few bytes at a time is still parsed"""
    c = Client()
    frame = encode('SET', key('slow'), 'drip')
    for i in range(0, len(frame), 3):
        c.sock.sendall(frame[i:i + 3])
        time.sleep(0.005)
    assert c.reply() == 'OK' and c('GET', key('slow')) == b'drip'


@check
def concurrent_clients():
    """20 clients each INCR one key 100 times: the result is 2000"""
    def worker():
        c = Client()
        for _ in range(100):
            c('INCR', key('shared'))
        c.close()

    threads = [threading.Thread(target=worker) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert Client()('GET', key('shared')) == b'2000'


def main():
    failed = 0
    for fn in CHECKS:
        try:
            fn()
            print(f'PASS  {fn.__doc__}')
        except Exception as e:  # an assertion, or the server not answering
            failed += 1
            print(f'FAIL  {fn.__doc__}\n      {type(e).__name__}: {e}')
    print(f'\n{len(CHECKS) - failed}/{len(CHECKS)} checks passed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
