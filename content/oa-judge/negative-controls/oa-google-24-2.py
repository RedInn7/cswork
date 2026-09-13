def solve(data):
    dp={}; answer=0
    for v in sorted(map(int,data[1:])):
        dp[v]=max(dp.get(v,0),dp.get(v-1,0)+1); answer=max(answer,dp[v])
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
