import sys
def solve(s):
 z=list(map(int,s.split()));n,q=z[:2];a=z[2:2+n];ops=[z[2+n+3*i:5+n+3*i] for i in range(q)];floor=0;last=[None]*n
 for t,x,v in reversed(ops):
  if t==2:floor=max(floor,x)
  elif last[x-1] is None:last[x-1]=v
 return " ".join(str(max(a[i],floor) if last[i] is None else last[i]) for i in range(n))
if __name__=='__main__': print(solve(sys.stdin.read()))
