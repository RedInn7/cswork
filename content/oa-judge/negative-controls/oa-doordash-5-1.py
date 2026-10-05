import sys
def solve(s):
 z=s.split();n,q=map(int,z[:2]);p=list(range(n+1));sz=[1]*(n+1)
 def f(x):
  while x!=p[x]:p[x]=p[p[x]];x=p[x]
  return x
 ans=0;i=2
 for _ in range(q):
  t=z[i];a,b=map(int,z[i+1:i+3]);i+=3;x,y=f(a),f(b)
  if t=="F" and x!=y:
   if sz[x]<sz[y]:x,y=y,x
   p[y]=x;sz[x]+=sz[y]
  elif t=="T":ans+=sz[x] if x==y else sz[x]+sz[y]
 return str(ans)
if __name__=='__main__': print(solve(sys.stdin.read()))
