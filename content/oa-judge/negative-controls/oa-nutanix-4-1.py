import sys
a=list(map(int,sys.stdin.read().split()));n=a[0];p=a[1:];seen=[False]*n;c=0
for i in range(n):
 if not seen[i]:
  c+=1;j=i
  while not seen[j]:seen[j]=True;j=p[j]-1
print(n-c)
