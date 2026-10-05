import sys
def solve(raw):
 z=list(map(int,raw.split())); R,C=z[:2]; a=[z[2+r*C:2+(r+1)*C] for r in range(R)]; seen=[[False]*C for _ in range(R)]; p=[[False]*C for _ in range(R)]; d=((-1,0),(1,0),(0,-1),(0,1))
 for r in range(R):
  for c in range(C):
   if seen[r][c]: continue
   q=[(r,c)]; seen[r][c]=True; comp=[]
   for x,y in q:
    comp.append((x,y))
    for dx,dy in d:
     u,v=x+dx,y+dy
     if 0<=u<R and 0<=v<C and not seen[u][v] and a[u][v]==a[r][c]: seen[u][v]=True; q.append((u,v))
   if len(comp)>=3:
    for x,y in comp: p[x][y]=True
 for r in range(R):
  for c in range(C):
   if p[r][c]: a[r][c]=0
 return chr(10).join(' '.join(map(str,row)) for row in a)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
