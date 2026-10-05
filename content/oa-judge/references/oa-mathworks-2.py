import math
def solve(s):
 d=list(map(int,s.split()));a=d[1:];limit=max(a,default=1);phi=list(range(limit+1))
 if limit>=1:phi[1]=1
 for p in range(2,limit+1):
  if phi[p]==p:
   for x in range(p,limit+1,p):phi[x]-=phi[x]//p
 return " ".join(str(phi[x]) for x in a)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
