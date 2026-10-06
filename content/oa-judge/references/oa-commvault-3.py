def solve(raw):
 z=list(map(int,raw.split()));n,m=z[:2];p=list(range(n));sz=[1]*n
 def find(x):
  while p[x]!=x:p[x]=p[p[x]];x=p[x]
  return x
 for i in range(m):
  a,b=z[2+2*i]-1,z[3+2*i]-1;a=find(a);b=find(b)
  if a!=b:
   if sz[a]<sz[b]:a,b=b,a
   p[b]=a;sz[a]+=sz[b]
 ans=n*(n-1)//2
 for i in range(n):
  if p[i]==i:ans-=sz[i]*(sz[i]-1)//2
 return str(ans)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
