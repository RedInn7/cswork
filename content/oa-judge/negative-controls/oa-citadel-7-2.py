def solve(raw):
    d=list(map(int,raw.split()));n,x,y=d[:3];a=d[3:];extra=x-y;low=0;high=(max(a)+y-1)//y
    while low<high:
        mid=(low+high)//2;need=0;base=mid*y
        for v in a:
            if v>base:need+=(v-base)//extra
            if need>mid:break
        if need<=mid:high=mid
        else:low=mid+1
    return str(low)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
