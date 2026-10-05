import sys
d=list(map(int,sys.stdin.read().split()));n,b=d[:2];c=d[2:2+n];s=d[2+n:2+2*n];k=d[2+2*n:];lo=0
for x,y,z in zip(c,s,k):
 while max(0,(lo+1)*x-y)*z<=b:lo+=1
print(lo)
