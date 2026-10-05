import sys
from collections import deque
g=[x.split() for x in sys.stdin.read().splitlines()[1:]];b=len(g);p=len(g[0]);q=deque();seen=set()
for i in range(b):
 for j in range(p):
  if g[i][j]=='Q':q.append((i,j));seen.add((i,j))
while q:
 r,c=q.popleft()
 for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
  x,y=r+dr,c+dc
  if 0<=x<b and 0<=y<p and g[x][y]!='x' and (x,y) not in seen:
   if g[x][y]=='W':print('DRIVE!');raise SystemExit
   seen.add((x,y));q.append((x,y))
print("DON'T DRIVE!")
