import sys
from collections import deque
def solve(raw):
 t=list(map(int,raw.split()));n,m,r=t[:3];p=3;g=[[] for _ in range(n)]
 for _ in range(m):u,v=t[p:p+2];p+=2;g[u-1].append(v-1);g[v-1].append(u-1)
 d=[-1]*n;d[r-1]=0;stack=[r-1]
 while stack:
  u=stack.pop()
  for v in g[u]:
   if d[v]<0:d[v]=d[u]+1;stack.append(v)
 return ' '.join(str(i+1) for i in sorted((i for i in range(n) if i!=r-1 and d[i]>=0),key=lambda i:(d[i],i)))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
