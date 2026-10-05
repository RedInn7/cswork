import sys
d=list(map(int,sys.stdin.read().split()));n,k=d[:2];a=d[2:2+n];b=d[2+n:];print(sum(a[:k])+sum(b[k:]))