import sys
def solve(raw):
 t=list(map(int,raw.split()));n=t[0];a=t[1:n+1];k=t[n+1];dp={};best=1
 for v in a:
  dp[v]=max(dp.get(v,0),dp.get(v^k,0)+2);best=max(best,dp[v])
 return str(best)
if __name__=='__main__':print(solve(sys.stdin.read()))
