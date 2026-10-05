import sys
d=list(map(int,sys.stdin.read().split()));print(' '.join(str(x-1) for x in d[1:]))
