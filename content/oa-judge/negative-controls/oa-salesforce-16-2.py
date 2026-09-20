def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:2+n]));sizes=list(map(int,d[2+n:]));q=sum(x>=2 for x in sizes)
    return str(a[-1]-a[0])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
