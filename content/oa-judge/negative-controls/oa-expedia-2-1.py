import sys
def solve(n,m,p):
 pos=[[0]*m for _ in range(n)]
 for u,row in enumerate(p):
  for k,s in enumerate(row): pos[u][s]=k
 wins=[0]*m
 for x in range(m):
  for y in range(m):
   if x==y: continue
   v=sum(pos[u][x]<pos[u][y] for u in range(n))
   if 2*v>n or (2*v==n and x>y): wins[x]+=1
 return " ".join(map(str,sorted(range(m),key=lambda s:(-wins[s],s))))
if __name__=="__main__":
 z=list(map(int,sys.stdin.buffer.read().split())); n,m=z[:2]; p=[z[2+i*m:2+(i+1)*m] for i in range(n)]; print(solve(n,m,p))
