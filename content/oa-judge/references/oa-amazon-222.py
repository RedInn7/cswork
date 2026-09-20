def solve(d):
    from collections import Counter
    n,k=map(int,d[:2]);freq=sorted(Counter(d[2:]).values(),reverse=True);return str(n-sum(freq[:k]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
