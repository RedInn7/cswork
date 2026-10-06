def solve(raw):
 z=list(map(int,raw.split()));n,k=z[:2];a=z[2:2+n];d=[0]*n
 for _ in range(2,k+1):d=[min((d[j]+a[i]-a[j] for j in range(i)),default=10**30) for i in range(n)]
 return str(min(d))
