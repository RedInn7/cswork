import sys
from collections import Counter
a=list(map(int,sys.stdin.read().split()))[1:]
c=Counter(''.join(sorted(str(x))) for x in a)
print(sum(v*(v-1)//2 for v in c.values()))
