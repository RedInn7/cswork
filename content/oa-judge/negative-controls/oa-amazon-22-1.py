import sys

def solve(raw):
    tokens = iter(map(int, raw.split()))
    n = next(tokens)
    positive = set()
    for _ in range(n):
        value = next(tokens)
        if value >= 0:
            positive.add(value)
    return str(len(positive))

if __name__ == '__main__':
    print(solve(sys.stdin.buffer.read()))
