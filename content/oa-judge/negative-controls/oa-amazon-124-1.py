def solve(d):
    s,t=d;mod=1000000007;m=len(t);dp=[0]*(m+1);dp[0]=1;greater=0
    for c in s:
        greater=(greater*2+dp[m])%mod
        for j in range(m-1,-1,-1):
            if c>t[j]:greater=(greater+dp[j])%mod
            elif c==t[j]:dp[j+1]=(dp[j+1]+dp[j])%mod
    return str((greater+dp[m])%mod)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
