def decode(data):
    pos = 0
    def line():
        nonlocal pos
        end = data.find(b"\n", pos)
        if end < 0:
            raise ValueError("missing header newline")
        value = data[pos:end]
        pos = end + 1
        return value
    count, keep = map(int, line().split())
    values = []
    for _ in range(count):
        length = int(line())
        if length < 0 or pos + length >= len(data) or data[pos + length:pos + length + 1] != b"\n":
            raise ValueError("invalid length-prefixed string")
        values.append(data[pos:pos + length])
        pos += length + 1
    if pos != len(data):
        raise ValueError("trailing bytes")
    return keep, values

def encode(values):
    out = [str(len(values)).encode() + b"\n"]
    for value in values:
        out.extend((str(len(value)).encode() + b"\n", value, b"\n"))
    return b"".join(out)

def solve(data):
    keep, values = decode(data)
    if keep < 0:
        raise ValueError("n must be nonnegative")
    return encode(values[-keep:] if keep else [])

if __name__ == "__main__":
    import sys
    sys.stdout.buffer.write(solve(sys.stdin.buffer.read()))
