def solve(raw):
    n,m,target=map(int,raw.split());mod=998244353;dp=[0]*64;dp[0]=1
    for _ in range(n):
        nxt=[0]*64
        for old,ways in enumerate(dp):
            for value in range(m+1):nxt[old|value]=(nxt[old^value]+ways)%mod
        dp=nxt
    return str(dp[target])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
