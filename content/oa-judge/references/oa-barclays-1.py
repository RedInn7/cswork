import sys

def digit_sum(value):
    return sum(map(int, str(value)))

def build_cycle():
    values = [0, 1]
    seen = {}
    a, b = 0, 1
    while (a, b) not in seen:
        seen[(a, b)] = len(values) - 1
        a, b = b, digit_sum(a) + digit_sum(b)
        values.append(b)
    start = seen[(a, b)]
    period = len(values) - 1 - start
    return values, start, period

VALUES, CYCLE_START, CYCLE_LENGTH = build_cycle()

def solve(raw):
    n = int(raw.strip())
    if n < len(VALUES):
        index = n
    else:
        index = CYCLE_START + (n - CYCLE_START) % CYCLE_LENGTH
    return str(VALUES[index])

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
