def solve(d):
    n,m,k=map(int,d[:3]);a=list(map(int,d[3:]))
    def valid(start):
        slots=1;used=0
        for i in range(start,n):
            v=a[i]
            if used+v>k:slots+=1;used=0
            used+=v
            if slots>m:return False
        return True
    lo=0;hi=n
    while lo<hi:
        mid=(lo+hi)//2
        if valid(mid):hi=mid
        else:lo=mid+1
    return str(n-lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
