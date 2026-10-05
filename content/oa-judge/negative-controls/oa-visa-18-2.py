import sys
from itertools import accumulate
def solve(s):
 z=list(map(int,s.split())); n=z[0]; groups=[[],[],[],[]]
 for i in range(n):
  c,x,y=z[1+3*i:4+3*i]; groups[0 if x and y else 1 if x else 2 if y else 3].append(c)
 both,one,two,_=groups
 for a in (both,one,two): a.sort()
 pref=[list(accumulate([0]+a)) for a in (both,one,two)]; B,X,Y=pref
 nb,nx,ny=map(len,(both,one,two)); ans=[]
 for k in range(1,n+1):
  lo=max(0,k-nx,k-ny); hi=min(k,nb,max(0,k-1))
  if lo>hi: ans.append('-1'); continue
  def cost(j): return B[j]+X[k-j]+Y[k-j]
  l,r=lo,hi
  while l<r:
   m=(l+r)//2
   if cost(m+1)-cost(m)>=0: r=m
   else: l=m+1
  ans.append(str(cost(l)))
 return ' '.join(ans)
if __name__=='__main__': print(solve(sys.stdin.read()))
