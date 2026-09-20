def solve(d):
    n=int(d[0]);a=list(map(int,d[1:n+1]));b=list(map(int,d[n+1:]));lo=0;hi=max(a)
    while lo<hi:
        mid=(lo+hi)//2;needed=sum(y for x,y in zip(a,b) if x>mid)
        if needed<=mid:hi=mid
        else:lo=mid+1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
