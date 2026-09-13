def solve(d):
    n=int(d[0]);position=[0]*(n+1)
    for i in range(n):position[int(d[i+1])]=i
    left=n;right=-1;result=[]
    for k in range(1,n+1):
        left=min(left,position[k]);right=max(right,position[k]);result.append('1' if right-left+1==k else '0')
    return ''.join(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
