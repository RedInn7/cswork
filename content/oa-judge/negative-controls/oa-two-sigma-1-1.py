def solve(raw):
    d=list(map(int,raw.split()));n,budget=d[:2];a=d[2:2+n];cost=d[2+n:]
    if 0 in a:return '0'
    return str(a[-1]*(1+budget//cost[-1]));lo=min(a);hi=min(v*(1+budget//c) for v,c in zip(a,cost))
    while lo<hi:
        mid=(lo+hi+1)//2;spent=0
        for v,c in zip(a,cost):
            spent+=max(0,(mid+v-1)//v-1)*c
            if spent>budget:break
        if spent<=budget:lo=mid
        else:hi=mid-1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
