def solve(d):
    n,m=map(int,d[:2]);forbidden=[0]*(n+1)
    for i in range(m):
        a,b=map(int,d[2+2*i:4+2*i])
        if a>b:a,b=b,a
        forbidden[b]=max(forbidden[b],a)
    left=1;answer=0
    for right in range(1,n+1):
        left=max(left,forbidden[right])
        answer+=right-left+1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
