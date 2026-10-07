import sys

def solve(raw):
    tokens = iter(map(int, raw.split()))
    n = next(tokens)
    answer = None
    for index in range(n):
        value = next(tokens)
        if index != value:
            answer = value if answer is None else answer | value
    return str(0 if answer is None else answer)

if __name__ == '__main__':
    print(solve(sys.stdin.buffer.read()))
