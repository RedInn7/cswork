import sys
d=list(map(int,sys.stdin.read().split()));n,b=d[:2];c=d[2:2+n];s=d[2+n:2+2*n];k=d[2+2*n:];print(max(0,min((b//z)//x for x,z in zip(c,k))))
