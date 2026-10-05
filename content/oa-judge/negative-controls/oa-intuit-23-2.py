import sys
v=list(map(int,sys.stdin.buffer.read().split()));n,m=v[:2];g=[v[2+r*m:2+(r+1)*m] for r in range(n)];q=[(r,c) for r in range(n) for c in range(m) if g[r][c]==2];need=sum(x!=2 for row in g for x in row);t=0
while q and need:
 nxt=[]
 for r,c in q:
  for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
   x,y=r+dr,c+dc
   if 0<=x<n and 0<=y<m and g[x][y]!=2:g[x][y]=2;need-=1;nxt.append((x,y))
 if not nxt:print(-1);break
 q=nxt;t+=1
else:print(t)
