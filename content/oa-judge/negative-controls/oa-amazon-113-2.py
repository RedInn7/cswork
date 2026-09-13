def solve(d):
    from collections import Counter
    s=d[0];x,y=map(int,d[1:]);counts=Counter(s);pairs=len(s)//2
    same=sum(f//2 for f in counts.values()) if x<=y else 0
    return str(same*x+(pairs-same)*y)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
