def solve(d):
    from collections import Counter
    n=int(d[0]);s=d[1];gap=int(d[2]);assert len(s)==n;counts=Counter(s);f=max(counts.values());c=sum(v==f for v in counts.values())
    return str(max(len(s),(f-1)*gap+c))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
