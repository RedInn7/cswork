import sys
from collections import deque
def solve(s):
 z=s.splitlines();R,C,Q=map(int,z[0].split());g=[list(x) for x in z[1:1+R]];d=[[-1]*C for _ in range(R)];q=deque()
 for i in range(R):
  for j in range(C):
   if g[i][j]=="D":d[i][j]=0;q.append((i,j))
 while q:
  i,j=q.popleft()
  for di,dj in ((1,0),(-1,0),(0,1),(0,-1)):
   x,y=i+di,j+dj
   if 0<=x<R and 0<=y<C and g[x][y]!="X" and d[x][y]<0:d[x][y]=d[i][j]+1;q.append((x,y))
 return " ".join(str(d[i][j] if 0<=i<R and 0<=j<C else -1) for i,j in (map(int,x.split()) for x in z[1+R:1+R+Q]))
if __name__=='__main__': print(solve(sys.stdin.read()))
