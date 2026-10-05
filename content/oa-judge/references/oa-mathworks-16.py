def solve(s):
 d=list(map(int,s.split()));n=d[0];a=d[1:];neg=-10**9;dp=[neg]*(n+1);dp[0]=0
 for x in a:
  for length in range(n-1,-1,-1):
   if dp[length]>=0:dp[length+1]=max(dp[length+1],dp[length]+(x==length+1))
 return str(max(dp[1:]))
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
