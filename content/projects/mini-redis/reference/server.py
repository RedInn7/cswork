"""Reference mini Redis over RESP2 (only for scripts/projects/verify.mjs). PORT env, default 6379."""
import math
import os
import socketserver
import threading
import time

lock = threading.Lock()
store = {}  # key -> (value bytes, expires_at monotonic or None)


def alive(key, now):
    entry = store.get(key)
    if entry and entry[1] is not None and entry[1] <= now:
        del store[key]
        return None
    return entry


def bulk(value):
    return b'$-1\r\n' if value is None else b'$%d\r\n%s\r\n' % (len(value), value)


def error(message):
    return b'-ERR ' + message.encode() + b'\r\n'


def run(args):
    name = args[0].upper()
    argc = len(args) - 1
    now = time.monotonic()
    arity = {b'PING': (0, 1), b'ECHO': (1, 1), b'GET': (1, 1), b'SET': (2, 5), b'DEL': (1, 1 << 20),
             b'EXISTS': (1, 1 << 20), b'INCR': (1, 1), b'EXPIRE': (2, 2), b'TTL': (1, 1)}
    if name not in arity:
        return error(f"unknown command '{args[0].decode(errors='replace')}'")
    low, high = arity[name]
    if not low <= argc <= high:
        return error(f"wrong number of arguments for '{name.decode().lower()}' command")
    with lock:
        if name == b'PING':
            return bulk(args[1]) if argc else b'+PONG\r\n'
        if name == b'ECHO':
            return bulk(args[1])
        if name == b'GET':
            entry = alive(args[1], now)
            return bulk(entry and entry[0])
        if name == b'SET':
            key, value, expires, mode = args[1], args[2], None, None
            options = [a.upper() for a in args[3:]]
            i = 0
            while i < len(options):
                if options[i] in (b'NX', b'XX') and mode is None:
                    mode = options[i]
                    i += 1
                elif options[i] in (b'EX', b'PX') and expires is None and i + 1 < len(options):
                    raw = args[3 + i + 1]
                    if not raw.isdigit() or int(raw) <= 0:
                        return error('invalid expire time in set')
                    expires = now + int(raw) * (1 if options[i] == b'EX' else 0.001)
                    i += 2
                else:
                    return error('syntax error')
            exists = alive(key, now) is not None
            if (mode == b'NX' and exists) or (mode == b'XX' and not exists):
                return bulk(None)
            store[key] = (value, expires)
            return b'+OK\r\n'
        if name in (b'DEL', b'EXISTS'):
            count = 0
            for key in args[1:]:
                if alive(key, now) is not None:
                    count += 1
                    if name == b'DEL':
                        del store[key]
            return b':%d\r\n' % count
        if name == b'INCR':
            entry = alive(args[1], now)
            try:
                n = int(entry[0]) if entry else 0
                if entry and entry[0] != str(n).encode():
                    raise ValueError
            except ValueError:
                return error('value is not an integer or out of range')
            if n + 1 >= 1 << 63:
                return error('increment or decrement would overflow')
            store[args[1]] = (str(n + 1).encode(), entry[1] if entry else None)
            return b':%d\r\n' % (n + 1)
        if name == b'EXPIRE':
            entry = alive(args[1], now)
            if not args[2].lstrip(b'-').isdigit():
                return error('value is not an integer or out of range')
            if entry is None:
                return b':0\r\n'
            store[args[1]] = (entry[0], now + int(args[2]))
            return b':1\r\n'
        if name == b'TTL':
            entry = alive(args[1], now)
            if entry is None:
                return b':-2\r\n'
            if entry[1] is None:
                return b':-1\r\n'
            return b':%d\r\n' % max(0, math.floor(entry[1] - now + 0.5))


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        while True:
            line = self.rfile.readline()
            if not line:
                return
            if not line.startswith(b'*') or not line.endswith(b'\r\n') or not line[1:-2].isdigit():
                self.wfile.write(error('Protocol error: expected an array of bulk strings'))
                return
            args = []
            for _ in range(int(line[1:-2])):
                head = self.rfile.readline()
                if not head.startswith(b'$') or not head[1:-2].isdigit():
                    self.wfile.write(error('Protocol error: expected a bulk string'))
                    return
                data = self.rfile.read(int(head[1:-2]) + 2)
                if len(data) < int(head[1:-2]) + 2:
                    return
                args.append(data[:-2])
            if args:
                self.wfile.write(run(args))


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 128


if __name__ == '__main__':
    Server(('127.0.0.1', int(os.environ.get('PORT', '6379'))), Handler).serve_forever()
