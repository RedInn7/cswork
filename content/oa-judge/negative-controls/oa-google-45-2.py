import sys

def solve(raw):
    values = list(map(int, raw.split()))
    n = values[0]
    starts, ends = values[1:1+n], values[1+n:]
    degree = []
    for i in range(n):
        degree.append(sum(
            starts[j] < ends[i] and starts[i] < ends[j]
            for j in range(n) if i != j
        ))
    return str(max(degree, default=0) + (1 if n else 0))

print(solve(sys.stdin.read()))
