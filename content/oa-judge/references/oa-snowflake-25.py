def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));dp=[0]+[10**30]*n
    for i in range(1,n+1):
        largest=-10**30;best=10**30
        for j in range(i-1,max(-1,i-k-1),-1):largest=max(largest,a[j]);best=min(best,dp[j]+largest)
        dp[i]=best
    return str(dp[n])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
