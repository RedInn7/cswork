import sys
MOD=1000000007
def solve(raw):
 d=list(map(int,raw.split()));k,n=d[:2];edges=list(zip(d[2::2],d[3::2]));g=[[] for _ in range(n)]
 for a,b in edges:a-=1;b-=1;g[a].append(b);g[b].append(a)
 ans=k%MOD
 for v in range(n):
  available=k-(1 if v==0 else 2);children=len(g[v]) if v==0 else len(g[v])-1;children=max(0,children)
  if available<children:return '0'
  for j in range(children):ans=ans*(available-j)%MOD
 return str(ans)
if __name__=='__main__': print(solve(sys.stdin.read()))
