def solve(d):
    from collections import Counter
    s=d[0];gap=int(d[1]);counts=Counter(s);f=max(counts.values());c=sum(v==f for v in counts.values())
    return str(max(len(s),(f-1)*(gap+1)+c))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
