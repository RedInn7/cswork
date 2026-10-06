def solve(raw):
 v=list(map(int,raw.split()));n,q=v[:2];a=v[2:2+n];s=v[2+n:2+n+q];t=v[2+n+q:2+n+2*q];R=[0]*n;L=[0]*n
 for i in range(n):
  if i+1<n:R[i]=1 if i==0 or a[i+1]-a[i]<a[i]-a[i-1] else a[i+1]-a[i]
  if i:L[i]=1 if i==n-1 or a[i]-a[i-1]<a[i+1]-a[i] else a[i]-a[i-1]
 pr=[0]*(n+1);pl=[0]*(n+1)
 for i in range(n):pr[i+1]=pr[i]+R[i];pl[i+1]=pl[i]+L[i]
 return ' '.join(str(pr[b]-pr[a] if a<b else pl[a+1]-pl[b+1] if a>b else 0) for a,b in zip(s,t))

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
