def solve(d):
    x,y=d;dp=[0]*(len(y)+1)
    for c in x:
        for j in range(len(y),0,-1):
            if c==y[j-1]:dp[j]=max(dp[j],dp[j-1]+1)
    return str(max(dp))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
