import sys
from math import isqrt

def solve(raw):
    data = list(map(int, raw.split()))
    n, q = data[0], data[1]
    tags = data[2:2+n]
    offset = 2+n
    queries = [(data[offset+2*i]-1, data[offset+2*i+1]-1, i) for i in range(q)]
    block = max(1, n // max(1, isqrt(q)))
    queries.sort(key=lambda x: (x[0]//block, x[1] if (x[0]//block)%2 == 0 else -x[1]))
    freq = {}
    answers = [0]*q
    groups = 0
    left, right = 0, -1
    for ql, qr, qi in queries:
        while left > ql:
            left -= 1
            v = tags[left]
            old = freq.get(v, 0)
            groups += old & 1
            freq[v] = old + 1
        while right < qr:
            right += 1
            v = tags[right]
            old = freq.get(v, 0)
            groups += old & 1
            freq[v] = old + 1
        while left < ql:
            v = tags[left]
            old = freq[v]
            groups -= (old - 1) & 1
            if old == 1:
                del freq[v]
            else:
                freq[v] = old - 1
            left += 1
        while right > qr:
            v = tags[right]
            old = freq[v]
            groups -= (old - 1) & 1
            if old == 1:
                del freq[v]
            else:
                freq[v] = old - 1
            right -= 1
        answers[qi] = groups
    return " ".join([str(groups)] * q)

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read().decode()))
