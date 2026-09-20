def solve(d):
    n,saving=map(int,d[:2]);a=list(map(int,d[2:2+n]));b=list(map(int,d[2+n:]));dp=[0]*(saving+1)
    for cost,future in zip(a,b):
        gain=future-cost
        if gain<=0 or cost>saving:continue
        for money in range(cost,saving+1):dp[money]=max(dp[money],dp[money-cost]+gain)
    return str(dp[saving])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
