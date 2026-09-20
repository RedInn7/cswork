def solve(raw):
    d=list(map(int,raw.split()));n,budget=d[:2];a=d[2:2+n];cost=d[2+n:];low=min(a);high=min(v*(budget//c+1) for v,c in zip(a,cost))
    while low<high:
        target=(low+high+1)//2;spent=0
        for v,c in zip(a,cost):
            spent+=max(0,(target+v-1)//v-1)*c
            if spent>budget:break
        if spent<=budget:low=target
        else:high=target-1
    return str(low)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
