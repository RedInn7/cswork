"""Reference KV store with a write-ahead log (only for scripts/projects/verify.mjs): cli.py --dir DIR."""
import argparse
import json
import os
import struct
import sys
import zlib

HEAD = struct.Struct('>II')  # crc32 of the payload, payload length


def record(op):
    payload = json.dumps(op).encode()
    return HEAD.pack(zlib.crc32(payload), len(payload)) + payload


def load(path):
    """The data and the length of the log's valid prefix; a torn or corrupt tail ends the log."""
    data, good = {}, 0
    if not os.path.exists(path):
        return data, 0
    with open(path, 'rb') as f:
        blob = f.read()
    while good + HEAD.size <= len(blob):
        crc, n = HEAD.unpack_from(blob, good)
        payload = blob[good + HEAD.size:good + HEAD.size + n]
        if len(payload) < n or zlib.crc32(payload) != crc:
            break
        op = json.loads(payload)
        if op[0] == 'S':
            data[op[1]] = op[2]
        else:
            data.pop(op[1], None)
        good += HEAD.size + n
    return data, good


def sync_dir(folder):
    fd = os.open(folder, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', required=True)
    folder = parser.parse_args().dir
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, 'wal.log')
    data, good = load(path)
    log = open(path, 'ab')
    log.truncate(good)  # drop a torn tail so new records follow valid ones

    def append(op):
        log.write(record(op))
        log.flush()
        os.fsync(log.fileno())

    for line in sys.stdin:
        cmd, _, rest = line.rstrip('\n').partition(' ')
        key, _, value = rest.partition(' ')
        if cmd == 'SET' and key and value:
            append(['S', key, value])
            data[key] = value
            out = 'OK'
        elif cmd == 'GET' and key and not value:
            out = data.get(key, '(nil)')
        elif cmd == 'DEL' and key and not value:
            existed = key in data
            if existed:
                append(['D', key])
                del data[key]
            out = '1' if existed else '0'
        elif cmd == 'COMPACT' and not rest:
            tmp = os.path.join(folder, 'wal.tmp')
            with open(tmp, 'wb') as f:
                f.write(b''.join(record(['S', k, v]) for k, v in data.items()))
                f.flush()
                os.fsync(f.fileno())
            log.close()
            os.replace(tmp, path)  # atomic: a crash leaves either the old log or the new one
            sync_dir(folder)
            log = open(path, 'ab')
            out = 'OK'
        else:
            out = 'ERR unknown or malformed command'
        sys.stdout.write(out + '\n')
        sys.stdout.flush()


if __name__ == '__main__':
    main()
