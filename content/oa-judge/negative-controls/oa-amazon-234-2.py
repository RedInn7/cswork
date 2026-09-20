def solve(d):
    a=list(map(int,d[1:]));dp=[1]*5;mod=1000000007
    for x,y in zip(a,a[1:]):
        nxt=[0]*5
        for j in range(5):
            for i in range(5):
                if (j>=i if y>x else j<i if y<x else j!=i):nxt[j]=(nxt[j]+dp[i])%mod
        dp=nxt
    return str(sum(dp)%mod)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
