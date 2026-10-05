import sys
def solve(raw):
 z=list(map(int,raw.split())); R,C=z[:2]; a=[z[2+r*C:2+(r+1)*C] for r in range(R)]; p=[[False]*C for _ in range(R)]; d=((-1,0),(1,0),(0,-1),(0,1))
 for r in range(R):
  for c in range(C):
   if sum(0<=r+dx<R and 0<=c+dy<C and a[r+dx][c+dy]==a[r][c] for dx,dy in d)>=3: p[r][c]=True
 for r in range(R):
  for c in range(C):
   if p[r][c]:
    for dx,dy in d:
     x,y=r+dx,c+dy
     if 0<=x<R and 0<=y<C and a[x][y]==a[r][c]: p[x][y]=True
 for r in range(R):
  for c in range(C):
   if p[r][c]: a[r][c]=0
 for c in range(C):
  keep=[a[r][c] for r in range(R) if a[r][c]]
  for r in range(R): a[r][c]=0
  for i,v in enumerate(keep): a[R-len(keep)+i][c]=v
 return chr(10).join(' '.join(map(str,row)) for row in a)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
