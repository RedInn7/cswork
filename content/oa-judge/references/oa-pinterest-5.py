from collections import deque
import sys
def solve(raw):
 z=list(map(int,raw.split())); rows,cols=z[:2]; a=[z[2+r*cols:2+(r+1)*cols] for r in range(rows)]; seen=[[False]*cols for _ in range(rows)]; pop=[[False]*cols for _ in range(rows)]; dirs=((-1,0),(1,0),(0,-1),(0,1))
 for r in range(rows):
  for c in range(cols):
   if seen[r][c]: continue
   color=a[r][c]; q=deque([(r,c)]); seen[r][c]=True; comp=[]
   while q:
    x,y=q.popleft(); comp.append((x,y))
    for dx,dy in dirs:
     nx,ny=x+dx,y+dy
     if 0<=nx<rows and 0<=ny<cols and not seen[nx][ny] and a[nx][ny]==color: seen[nx][ny]=True; q.append((nx,ny))
   if len(comp)>=3:
    for x,y in comp: pop[x][y]=True
 for r in range(rows):
  for c in range(cols):
   if pop[r][c]: a[r][c]=0
 for c in range(cols):
  keep=[a[r][c] for r in range(rows) if a[r][c]!=0]
  for r in range(rows): a[r][c]=0
  for i,v in enumerate(keep): a[rows-len(keep)+i][c]=v
 return chr(10).join(' '.join(map(str,row)) for row in a)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
