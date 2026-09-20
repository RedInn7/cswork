def solve(d):
    n,q=map(int,d[:2]);a=list(map(int,d[2:2+n]));b=list(map(int,d[2+n:]));costs=sorted(max(0,y-x) for x,y in zip(a,b));answer=0
    for cost in costs:
        if cost>q:break
        q-=cost;answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
