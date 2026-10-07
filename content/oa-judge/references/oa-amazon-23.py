import sys

def solve(raw):
    tokens = iter(map(int, raw.split()))
    n = next(tokens)
    even = odd = 0
    largest = -1000000001
    for index in range(n):
        value = next(tokens)
        largest = max(largest, value)
        if value > 0:
            if index % 2:
                odd += value
            else:
                even += value
    return str(max(even, odd) if max(even, odd) > 0 else largest)

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read()))
