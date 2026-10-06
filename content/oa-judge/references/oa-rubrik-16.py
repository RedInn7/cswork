def solve(raw):
 t=list(map(int,raw.split()));n,d=t[:2];a=t[2:2+n];ans=0
 for i in range(n-2):
  freq={}
  for k in range(i+1,n):
   r=a[k]%d;freq[r]=freq.get(r,0)+1
  for j in range(i+1,n-1):
   r=a[j]%d;freq[r]-=1;ans+=freq.get((-a[i]-a[j])%d,0)
 return str(ans)
