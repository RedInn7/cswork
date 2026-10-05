import sys
from collections import Counter
d=sys.stdin.read().split();w=d[1:];p=[tuple(abs(ord(x[i+1])-ord(x[i])) for i in range(len(x)-1)) for x in w];c=Counter(p);print(next((x for x,y in zip(w,p) if c[y]==1),''))
