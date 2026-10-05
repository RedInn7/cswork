import sys,math
d=list(map(int,sys.stdin.read().split()));print(' '.join(str(sum(math.gcd(i,x)==1 for i in range(1,x))) for x in d[1:]))
