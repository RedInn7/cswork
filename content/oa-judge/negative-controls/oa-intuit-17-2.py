import sys
v=list(map(int,sys.stdin.buffer.read().split()));n,m=v[:2];a=[v[2+r*m:2+(r+1)*m] for r in range(n)];ans=None
for r in range(n):
 for c in range(m):
  for x,y in ((r+1,c),(r,c+1)):
   if x<n and y<m:
    z=a[x][y]-a[r][c];ans=z if ans is None else max(ans,z)
print(ans)
