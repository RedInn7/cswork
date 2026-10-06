def solve(raw):
 z=list(map(int,raw.split()));n,k=z[:2];a=z[2:2+n];d=[[10**30]*n for _ in range(k+1)]
 for i in range(n):d[1][i]=0
 for q in range(2,k+1):
  for i in range(n):
   if i:d[q][i]=d[q-1][i-1]+abs(a[i]-a[i-1])
 return str(min(d[k]))
