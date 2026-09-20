def solve(d):
    import json
    s=json.loads(''.join(d));n=len(s)
    if not n:return '0'
    dp=[[0]*n for _ in range(n)]
    for l in range(n-1,-1,-1):
        dp[l][l]=1
        for r in range(l+1,n):
            best=1+dp[l+1][r]
            for k in range(l+1,r+1):
                if s[l]==s[k]:best=min(best,(dp[l+1][k-1] if k>l+1 else 0)+dp[k][r])
            dp[l][r]=best
    return str(dp[0][n-1])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
