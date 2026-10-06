import sys
from collections import deque
def solve(raw):
 v=list(map(int,raw.split())); n=v[0]; p=v[1:1+n]; out=['0']*n
 for k in range(1,n+1):
  mx=deque(); mn=deque()
  for i,x in enumerate(p):
   while mx and p[mx[-1]]<=x: mx.pop()
   mx.append(i)
   while mn and p[mn[-1]]>=x: mn.pop()
   mn.append(i)
   if mx[0]<=i-k: mx.popleft()
   if mn[0]<=i-k: mn.popleft()
   if i>=k-1 and p[mx[0]]==k and p[mn[0]]==1:
    out[k-1]='1'; break
 return ''.join(out)
if __name__ == "__main__": print(solve(sys.stdin.read()))
