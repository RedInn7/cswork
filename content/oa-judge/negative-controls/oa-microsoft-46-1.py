def solve(d):
    n=int(d[0]);dp=[0]*7
    for i in range(1,len(d),2):
        left,right=int(d[i]),int(d[i+1]);candidate=dp[left]+1;dp[right]=max(dp[right],candidate);dp[left]=max(dp[left],dp[right])
    return str(n-max(dp))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
