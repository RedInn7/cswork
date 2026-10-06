def solve(raw):
 z=list(map(int,raw.split()));n,m=z[:2];p=list(range(n))
 def f(x):
  if p[x]!=x:p[x]=f(p[x])
  return p[x]
 for i in range(m):
  a=f(z[2+2*i]-1);b=f(z[3+2*i]-1);p[a]=b
 return str(sum(f(i)==f(j) for i in range(n) for j in range(i+1,n)))
