def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:]));lo=1;hi=max(a)
    while lo<hi:
        mid=(lo+hi)//2;needed=(sum(a)+mid-1)//mid
        if needed<=m:hi=mid
        else:lo=mid+1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
