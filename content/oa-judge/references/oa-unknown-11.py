import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, target = data[:2]
    numbers = data[2:]
    seen = {}
    for j, value in enumerate(numbers):
        complement = target - value
        if complement in seen:
            return f'{seen[complement]} {j}'
        seen[value] = j
    raise ValueError('input must have one distinct-index solution')

if __name__ == '__main__':
    print(solve(sys.stdin.buffer.read()))
