import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, k = data[:2]
    strengths = data[2:]
    selected = sorted((i for i in range(n) if strengths[i] > 1), key=lambda i: strengths[i], reverse=False)[:min(k, n)]
    used = set(selected)
    big = [i + 1 for i in range(n) if i in used]
    small = [i + 1 for i in range(n) if i not in used]
    total = len(big) + sum(strengths[i - 1] for i in small)
    return str(total) + '\n' + (' '.join(map(str, big)) if big else '-1') + '\n' + (' '.join(map(str, small)) if small else '-1')

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
