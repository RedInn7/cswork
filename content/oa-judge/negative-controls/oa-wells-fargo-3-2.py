import heapq,sys
def solve(raw):
 t=raw.split();R,C=map(int,t[:2]);g=t[2:2+R];obs=[(r,c) for r in range(R) for c in range(C) if g[r][c]=='*'];s=next((r,c) for r in range(R) for c in range(C) if g[r][c]=='S');e=next((r,c) for r in range(R) for c in range(C) if g[r][c]=='E');d=[[min(abs(r-x)+abs(c-y) for x,y in obs) for c in range(C)] for r in range(R)];b=[[-1]*C for _ in range(R)];b[s[0]][s[1]]=d[s[0]][s[1]];h=[(-b[s[0]][s[1]],*s)]
 while h:
  q,r,c=heapq.heappop(h);v=-q
  if (r,c)==e:return str(v)
  if v<b[r][c]:continue
  for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
   x,y=r+dr,c+dc
   if 0<=x<R and 0<=y<C and g[x][y]!='*' and min(v,d[x][y])>b[x][y]:b[x][y]=min(v,d[x][y]);heapq.heappush(h,(-b[x][y],x,y))
 return '-1'
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
