import sys
d=list(map(int,sys.stdin.read().split()));n,m=d[:2];a=d[2:];print((sum(a)+n-1)//n)