def solve(d):
    a=list(map(int,d[1:]));n=len(a)
    if n<2:return '0'
    answer=0
    for target in {a[0]+a[1],a[-2]+a[-1],a[0]+a[-1]}:
        dp=[[0]*n for _ in range(n)]
        for length in range(2,n+1):
            for left in range(n-length+1):
                right=left+length-1;best=0
                if a[left]+a[left+1]==target:best=max(best,1+(dp[left+2][right] if length>2 else 0))
                if a[right-1]+a[right]==target:best=max(best,1+(dp[left][right-2] if length>2 else 0))
                if False:best=max(best,1+(dp[left+1][right-1] if length>2 else 0))
                dp[left][right]=best
        answer=max(answer,dp[0][-1])
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
