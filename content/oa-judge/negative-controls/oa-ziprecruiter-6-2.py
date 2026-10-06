import sys
a=list(map(int,sys.stdin.read().split()))[1:]
ans=0
for i,x in enumerate(a):
 s=str(x)
 for y in a[i+1:]:
  t=str(y)
  if len(s)==len(t) and (s==t or s[1:]+s[:1]==t): ans+=1
print(ans)
