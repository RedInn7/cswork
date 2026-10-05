import sys
d=list(map(int,sys.stdin.read().split()));n,m=d[:2];a=d[2:];print(sum((a[i]+a[j]+a[k])%m==0 for i in range(n) for j in range(n) for k in range(n))//6)
