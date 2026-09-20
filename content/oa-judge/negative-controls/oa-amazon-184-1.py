def solve(d):
    n,inc,dec=map(int,d[:3]);a=list(map(int,d[3:]));lo=min(a);hi=sum(a)//n
    while lo<hi:
        mid=(lo+hi+1)//2;need=supply=0
        for v in a:
            if v<mid:need+=(mid-v)//inc
            else:supply+=(v-mid)//dec
        if supply>=need:lo=mid
        else:hi=mid-1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
