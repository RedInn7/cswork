def solve(d):
    s=d[0];n=len(s);dp=[0]*(n+1)
    for end in range(1,n+1):
        color=None;best=0
        for start in range(end-1,-1,-1):
            c=s[start]
            if c!='.':
                if color is not None and c!=color:break
                color=c
            length=end-start;best=max(best,dp[start]+length*(length-1)//2)
        dp[end]=best
    return str(dp[n])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
