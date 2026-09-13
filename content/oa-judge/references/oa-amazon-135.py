def solve(d):
    m,children=map(int,d[:2]);games=list(map(int,d[2:]));total=sum(games);lo=max(max(games),(total+children-1)//children);hi=total
    def feasible(capacity):
        dp=[(m+1,0)]*(1<<m);dp[0]=(1,0)
        for mask in range(1,1<<m):
            best=(m+1,0);bits=mask
            while bits:
                bit=bits&-bits;i=bit.bit_length()-1;rides,load=dp[mask^bit]
                candidate=(rides,load+games[i]) if load+games[i]<=capacity else (rides+1,games[i])
                if candidate<best:best=candidate
                bits-=bit
            dp[mask]=best
        return dp[-1][0]<=children
    while lo<hi:
        middle=(lo+hi)//2
        if feasible(middle):hi=middle
        else:lo=middle+1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
