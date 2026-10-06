import sys
t=list(map(int,sys.stdin.read().split()));n=t[0];a=t[1:n+1];lo,hi=t[n+1:];c=0
for i in range(n):
 s=0
 for x in a[i:]:
  s+=x
  if lo<=s<=hi and s>=0:c+=1
print(c)
