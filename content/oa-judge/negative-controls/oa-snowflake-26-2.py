def solve(d):
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:1+2*n]));c=list(map(int,d[1+2*n:]));values=[a,b,c]
    if n==1:return str(b[0])
    dp=[b[0],a[0]]
    for i in range(1,n-1):dp=[max(dp[left]+values[left+1][i] for left in (0,1)),max(dp[left]+values[left][i] for left in (0,1))]
    return str(max(dp[left]+values[left][n-1] for left in (0,1)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
