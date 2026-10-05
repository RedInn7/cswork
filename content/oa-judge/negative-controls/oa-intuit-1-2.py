import sys
from collections import deque
lines=sys.stdin.read().splitlines();b,p=map(int,lines[0].split());g=[x.split() for x in lines[1:1+b]];q=deque();seen=set()
for r in range(b):
 for c in range(p):
  if g[r][c]=='Q':
   for d in range(4):q.append((r,c,d,0));seen.add((r,c,d,0))
dirs=((1,0),(-1,0),(0,1),(0,-1))
while q:
 r,c,d,t=q.popleft()
 for nd,(dr,dc) in enumerate(dirs):
  nt=t+(nd!=d);x,y=r+dr,c+dc;z=(x,y,nd,nt)
  if nt<=1 and 0<=x<b and 0<=y<p and g[x][y]!='x' and z not in seen:
   if g[x][y]=='W':print('DRIVE!');raise SystemExit
   seen.add(z);q.append(z)
print("DON'T DRIVE!")
