def solve(d):
    a=list(map(int,d[1:]));n=len(a);prime=bytearray(b'\1')*n
    for p in range(2,n):
        if prime[p]:
            for multiple in range(p*p,n,p):prime[multiple]=0
    steps=[1]+[p for p in range(3,n,10) if prime[p]];dp=[-10**30]*n;dp[0]=0
    for i in range(1,n):dp[i]=a[i]+max(dp[i-p] for p in steps if p<=i)
    return str(max(dp))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
