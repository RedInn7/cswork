import sys
d=list(map(int,sys.stdin.read().split()));n=d[0];a=d[1:n+1];g=[[] for _ in a];p=n+1
for _ in range(n-1):u,v=d[p]-1,d[p+1]-1;p+=2;g[u].append(v);g[v].append(u)
z=0;st=[(0,-1,0)]
while st:
 u,b,k=st.pop();z+=k*a[u];st += [(v,u,k+1) for v in g[u] if v!=b]
print(z)
