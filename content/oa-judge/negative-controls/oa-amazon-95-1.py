def solve(d):
    c,s=d;m=len(s);mod=1000000007;dp=[1]+[0]*m;greater=0
    for ch in c:
        greater=(greater*2)%mod
        for j in range(m-1,-1,-1):
            if ch>s[j]:greater=(greater+dp[j])%mod
            elif ch==s[j]:dp[j+1]=(dp[j+1]+dp[j])%mod
    return str(greater)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
