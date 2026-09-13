def solve(d):
    a=list(map(int,d[1:]));n=len(a);dp=[0]*(n+1)
    for i in range(n-1,-1,-1):
        dp[i]=1+dp[i+1];end=i+a[i]+1
        if end<=n:dp[i]=min(dp[i],dp[end])
    return str(dp[0])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
