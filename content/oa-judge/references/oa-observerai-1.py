def solve(raw):
 z=raw.splitlines();p=0;n=int(z[p]);p+=1;req=list(map(int,z[p].split()));p+=1;req.sort();f=int(z[p]);p+=1;best=None
 for i in range(f):
  m=int(z[p]);p+=1;a=list(map(int,z[p].split()))[:m];p+=1;j=0;cost=0;ok=True
  for x in req:
   while j<m and a[j]<x:j+=1
   if j==m:ok=False;break
   cost+=a[j]-x
  if ok and (best is None or (cost,i)<best):best=(cost,i)
 return str(-1 if best is None else best[1])

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
