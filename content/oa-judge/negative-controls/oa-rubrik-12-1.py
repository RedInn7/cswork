import sys
t=list(map(int,sys.stdin.read().split()));n,z=t[:2];a=t[2:];b=0
for i in range(n):
 c=a[:];c[i]*=z;s=m=0
 for x in c:s=max(0,s+x);m=max(m,s)
 b=max(b,m)
print(b)
