def solve(d):
    n=int(d[0]);a=list(map(int,d[1:n+1]));s=d[n+1];dp=[0,-10**30]
    for i in range(n-1,-1,-1):
        nxt=[-10**30,-10**30]
        for incoming in (0,1):
            if s[i]=='0':nxt[0]=max(nxt[0],dp[incoming]+(a[i] if incoming else 0))
            else:
                nxt[0]=max(nxt[0],dp[incoming]+a[i])
                if i>0:nxt[1]=max(nxt[1],dp[incoming]+(a[i] if incoming else 0))
        dp=nxt
    return str(dp[0])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
