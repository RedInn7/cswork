def solve(d):
    n=int(d[0]);flat=list(map(int,d[1:]));g=[flat[i*n:(i+1)*n] for i in range(n)];neg=-10**9
    if g[0][0]<0 or g[-1][-1]<0:return '0'
    dp=[[neg]*n for _ in range(n)];dp[0][0]=0
    for step in range(1,2*n-1):
        nxt=[[neg]*n for _ in range(n)]
        for a in range(max(0,step-n+1),min(n-1,step)+1):
            if g[a][step-a]<0:continue
            for b in range(max(0,step-n+1),min(n-1,step)+1):
                if g[b][step-b]<0:continue
                value=dp[a][b]
                if a:value=max(value,dp[a-1][b])
                if b:value=max(value,dp[a][b-1])
                if a and b:value=max(value,dp[a-1][b-1])
                if value>=0:nxt[a][b]=value+g[a][step-a]+(g[b][step-b] if a!=b else 0)
        dp=nxt
    return str(max(0,dp[-1][-1]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
