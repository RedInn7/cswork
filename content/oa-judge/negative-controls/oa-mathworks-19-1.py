import sys
d=list(map(int,sys.stdin.read().split()));print(sum(x for x in d[1:] if x>0))
