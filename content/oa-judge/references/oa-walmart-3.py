import sys

def solve(raw):
    a = list(map(int, raw.split()))
    best = None
    for i, j in ((0, 1), (0, 2), (1, 2)):
        if a[i] % 3 == a[j] % 3:
            steps = max(a[i], a[j])
            if best is None or steps < best:
                best = steps
    return str(-1 if best is None else best)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
