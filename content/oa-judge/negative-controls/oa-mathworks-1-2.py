import sys
d=list(map(int,sys.stdin.read().split()));n,m=d[:2];print(n*(n-1)*(n-2)//6)
