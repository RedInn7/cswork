def solve(d):
    n,x,y=map(int,d[:3]);a=list(map(int,d[3:]));extra=x-y;lo=0;hi=(max(a)+y-1)//y
    while lo<hi:
        t=(lo+hi)//2;need=sum(max(0,(v+extra-1)//extra) for v in a)
        if need<=t:hi=t
        else:lo=t+1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
