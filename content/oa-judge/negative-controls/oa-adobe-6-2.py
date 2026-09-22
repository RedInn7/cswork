def solve(raw):
    d=list(map(int,raw.split()));n,x,y=d[:3];a=d[3:];delta=x-y;lo=0;hi=sum((v+x-1)//x for v in a)
    while lo<hi:
        t=(lo+hi)//2;need=0
        for v in a:
            need=max(need,max(0,v-t*y+delta-1)//delta)
            if need>t:break
        if need<=t:hi=t
        else:lo=t+1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
