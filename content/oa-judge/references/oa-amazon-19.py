def solve(d):
    n,m=map(int,d[:2]); h=list(map(int,d[2:2+n])); t=list(map(int,d[2+n:])); totals={}
    for value,kind in zip(h,t): totals[kind]=totals.get(kind,0)+value
    return str(sum(sorted(totals.values(),reverse=True)[:m]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
