def solve(raw):
    import json
    x,y=json.loads(raw);dp=[0]*(len(y)+1)
    for ch in x:
        for j in range(1,len(y)+1):
            if ch==y[j-1]:dp[j]=max(dp[j],dp[j-1]+1)
    return str(max(dp))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
