import sys
d=list(map(int,sys.stdin.read().split()));print(sum(x==i+1 for i,x in enumerate(d[1:])))
