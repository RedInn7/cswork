def solve(d):
    a=list(map(int,d[1:]));direction=run=0;best=1
    for x,y in zip(a,a[1:]):
        if x==y:continue
        sign=1 if y>x else -1;run=run+1 if sign==direction else 1;direction=sign;best=max(best,run+1)
    return str(best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
