import heapq,sys
from collections import deque
def solve(raw):
 t=raw.split();R,C=map(int,t[:2]);g=t[2:2+R];d=[[-1]*C for _ in range(R)];q=deque();s=e=None
 for r in range(R):
  for c,ch in enumerate(g[r]):
   if ch=='*':d[r][c]=0;q.append((r,c))
   elif ch=='S':s=(r,c)
   elif ch=='E':e=(r,c)
 for r,c in q:
  pass
 while q:
  r,c=q.popleft()
  for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
   x,y=r+dr,c+dc
   if 0<=x<R and 0<=y<C and d[x][y]<0:d[x][y]=d[r][c]+1;q.append((x,y))
 best=[[-1]*C for _ in range(R)];best[s[0]][s[1]]=d[s[0]][s[1]];h=[(-best[s[0]][s[1]],*s)]
 while h:
  neg,r,c=heapq.heappop(h);v=-neg
  if v<best[r][c]:continue
  if (r,c)==e:return str(v)
  for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
   x,y=r+dr,c+dc
   if 0<=x<R and 0<=y<C:
    nv=min(v,d[x][y])
    if nv>best[x][y]:best[x][y]=nv;heapq.heappush(h,(-nv,x,y))
 return '-1'
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
