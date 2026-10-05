import sys
from collections import deque
def solve(s):
 z=list(map(int,s.split())); n=z[0]; h=z[1:]
 def ok(k):
  d=deque()
  for i,x in enumerate(h):
   while d and d[0]<=i-k: d.popleft()
   while d and h[d[-1]]>=x: d.pop()
   d.append(i)
   if i>=k-1 and h[d[0]]>=k: return True
  return False
 lo,hi=0,min(n,max(h,default=0))
 while lo<hi:
  mid=(lo+hi+1)//2
  if ok(mid): lo=mid
  else: hi=mid-1
 return str(lo*lo)
if __name__=='__main__': print(solve(sys.stdin.read()))
