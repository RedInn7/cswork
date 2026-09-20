def solve(d):
    pattern,text=d;dp=[1,0,0,0]
    for c in text:
        for j in range(3,0,-1):
            if c==pattern[j-1]:dp[j]+=dp[j-1]
    return str(dp[3]%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
