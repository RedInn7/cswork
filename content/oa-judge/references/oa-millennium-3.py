def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; x=a[1:1+n]; dp=[0]*(n+1)
 for i in range(n-1,-1,-1):
  dp[i]=dp[i+1]
  if i+1<n: dp[i]=max(dp[i],dp[i+2]+max(0,x[i]-x[i+1]))
 return str(sum((i+1)*v for i,v in enumerate(x))+dp[0])
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
