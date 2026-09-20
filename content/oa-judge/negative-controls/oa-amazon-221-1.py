def solve(d):
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:]));delta=[y-x for x,y in zip(a,b)];down=sum(max(0,x-y) for x,y in zip(delta,delta[1:]))
    return str(-1 if min(delta)<0 else delta[-1]+down)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
