def solve(d):
    from collections import Counter
    a=list(map(int,d[1:]));counts=Counter(a);a.sort(key=lambda v:(counts[v],v))
    return ' '.join(map(str,a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
