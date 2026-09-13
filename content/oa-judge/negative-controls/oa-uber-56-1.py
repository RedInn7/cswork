def solve(d):
    n,budget=map(int,d[:2]);base=list(map(int,d[2:2+n]));cost=list(map(int,d[2+n:]));low=min(base);high=min(v*(1+budget//c) for v,c in zip(base,cost))
    while low<high:
        target=(low+high+1)//2;spent=0
        for v,c in zip(base,cost):
            spent+=max(0,target//v)*c
            if spent>budget:break
        if spent<=budget:low=target
        else:high=target-1
    return str(low)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
