def solve(s):
 d=list(map(int,s.split()));n=d[0];a=d[1:n+1];g=[[] for _ in range(n)];p=n+1
 for _ in range(n-1):
  u,v=d[p]-1,d[p+1]-1;p+=2;g[u].append(v);g[v].append(u)
 parent=[-1]*n;depth=[0]*n;order=[0];parent[0]=0
 for u in order:
  for v in g[u]:
   if parent[v]<0:parent[v]=u;depth[v]=depth[u]+1;order.append(v)
 sub=a[:]
 for v in order[:0:-1]:sub[parent[v]]+=sub[v]
 beauty=[0]*n;beauty[0]=sum(depth[i]*a[i] for i in range(n));total=sum(a)
 for v in order[1:]:beauty[v]=beauty[parent[v]]+total-2*sub[v]
 return str(max(beauty))
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
