def solve(d):
    n=int(d[0]);words=d[1:n+1];t=d[n+1];m=len(words[0]);freq=[[0]*26 for _ in range(m)]
    for word in words:
        for i,c in enumerate(word):freq[i][ord(c)-97]+=1
    dp=[1]+[0]*len(t)
    for i,row in enumerate(freq):
        for j in range(min(i+1,len(t)),0,-1):dp[j]=(dp[j]+dp[j-1]*row[ord(t[j-1])-97])%1000000007
    return str(dp[-1])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
