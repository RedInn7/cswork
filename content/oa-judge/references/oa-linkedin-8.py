def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];a=d[2:];dp=[0]+[10**30]*n
    for groups in range(1,k+1):
        nxt=[10**30]*(n+1)
        for end in range(groups,n+1):
            maximum=0
            for start in range(end-1,groups-2,-1):maximum=max(maximum,a[start]);nxt[end]=min(nxt[end],dp[start]+maximum)
        dp=nxt
    return str(dp[n])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
