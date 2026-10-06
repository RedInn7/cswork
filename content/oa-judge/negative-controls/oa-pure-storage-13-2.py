import sys
def solve(raw):
 lines=raw.splitlines(); p=lines[0] if lines else ''; s=lines[1] if len(lines)>1 else ''
 if not p or not s: return '0'
 m=len(p); dp=[0]*(len(s)+1); best=0
 for end in range(m,len(s)+1,m):
  if s[end-m:end]==p: dp[end]=dp[end-m]+1; best=max(best,dp[end])
 return str(best)
if __name__=='__main__': print(solve(sys.stdin.read()))
