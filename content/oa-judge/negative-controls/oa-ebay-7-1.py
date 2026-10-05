import sys
def scan(a):
 ans=0;prev=None;sg=None;digit=False
 for c in a:
  if c.isdigit():
   x=int(c);v=x if sg is None or prev is None else max(x,prev+sg*x);ans=max(ans,v);prev=v;sg=None;digit=True
  elif c in "+-" and digit:sg=-1 if c=="+" else 1;digit=False
  else:prev=None;sg=None;digit=False
 return ans
def solve(s):
 z=s.splitlines();h,w=map(int,z[0].split());g=[list(x) for x in z[1:1+h]];ans=max(scan(x) for x in g)
 for j in range(w):ans=max(ans,scan([g[i][j] for i in range(h)]))
 return str(ans)
if __name__=='__main__': print(solve(sys.stdin.read()),end='')
