import sys
def solve(raw):
 t=list(map(int,raw.split()));n,m,root=t[:3];p=3;g=[[] for _ in range(n)]
 for _ in range(m):u,v=t[p:p+2];p+=2;u-=1;v-=1;g[u].append(v);g[v].append(u)
 d=[-1]*n;d[root-1]=0;q=deque([root-1])
 while q:
  u=q.popleft()
  for v in g[u]:
   if d[v]<0:d[v]=d[u]+1;q.append(v)
 return ' '.join(str(i+1) for i in sorted((i for i in range(n) if i!=root-1 and d[i]>=0),key=lambda i:(d[i],i)))
from collections import deque
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
