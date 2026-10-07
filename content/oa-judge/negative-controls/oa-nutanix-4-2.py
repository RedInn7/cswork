import sys
a=list(map(int,sys.stdin.read().split()));n=a[0];p=a[1:];ans=n
for k in range(n):
 if p[k]!=1:continue
 q=p[k:]+p[:k];seen=[False]*n;c=0
 for i in range(n):
  if not seen[i]:
   c+=1;j=i
   while not seen[j]:seen[j]=True;j=q[j]-1
 ans=min(ans,k+n-c)
print(ans)
