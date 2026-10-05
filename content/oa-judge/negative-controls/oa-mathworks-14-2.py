import sys
d=list(map(int,sys.stdin.read().split()));n,m=d[:2];a=d[2:];q,r=divmod(m,n);p=0;z=[]
for i in range(n):j=p+q+(i<r);z.append(sum(a[p:j]));p=j
print(max(z))