def solve(d):
    n,m,k=map(int,d[:3]);owned=set(map(int,d[3:]));answer=m
    for v in range(1,n+1):
        if v in owned:continue
        if v>k:break
        k-=v;answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
