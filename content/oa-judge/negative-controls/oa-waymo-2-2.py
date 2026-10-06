import heapq
def solve(raw):
 v=list(map(int,raw.split()));n,m,s,q=v[:4];p=4;g=[[] for _ in range(n)]
 for _ in range(m):
  a,b,w=v[p]-1,v[p+1]-1,v[p+2];p+=3;g[a].append((b,w))
 ts=[x-1 for x in v[p:p+q]];d=[10**30]*n;d[s-1]=1;h=[(0,s-1)]
 while h:
  x,u=heapq.heappop(h)
  if x!=d[u]:continue
  for z,w in g[u]:
   if x+w<d[z]:d[z]=x+w;heapq.heappush(h,(x+w,z))
 return ' '.join(str(d[z] if d[z]<10**30 else -1) for z in ts)

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
