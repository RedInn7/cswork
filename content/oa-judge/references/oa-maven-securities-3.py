import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, values = data[0], data[1:]
    limit = max(values, default=1)
    spf = list(range(limit + 1))
    for p in range(2, int(limit ** 0.5) + 1):
        if spf[p] == p:
            for multiple in range(p * p, limit + 1, p):
                if spf[multiple] == multiple:
                    spf[multiple] = p

    parent = list(range(n))
    size = [1] * n
    prime_owner = {}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        a, b = find(a), find(b)
        if a == b:
            return
        if size[a] < size[b]:
            a, b = b, a
        parent[b] = a
        size[a] += size[b]

    for i, value in enumerate(values):
        x = value
        while x > 1:
            prime = spf[x]
            if prime in prime_owner:
                union(i, prime_owner[prime])
            else:
                prime_owner[prime] = i
            while x % prime == 0:
                x //= prime

    counts = {}
    for i in range(n):
        root = find(i)
        counts[root] = counts.get(root, 0) + 1
    return "[" + ",".join(str(counts[find(i)]) for i in range(n)) + "]"

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
