import sys
def solve(s):
 z=s.splitlines(); n=int(z[0]); a=z[1:1+n]; t={}; end='!'
 for w in a:
  x=t
  for c in w: x=x.setdefault(c,{})
  x[end]=x.get(end,0)+1
 ans=0
 for w in a:
  x=t
  for c in w: x=x[c]; ans+=x.get(end,0)
  pass
 return str(ans)
if __name__=='__main__': print(solve(sys.stdin.read()))
