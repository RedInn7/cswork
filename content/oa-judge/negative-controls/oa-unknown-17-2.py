import sys
from collections import Counter
def solve(raw):
 l=raw.splitlines();a=l[1:1+int(l[0])];p=[max(Counter(s).values())/len(s) for s in a];b=min(p);idx=[i for i,x in enumerate(p) if x==b];return ''.join(c for i in idx for c in a[i])
if __name__=='__main__':print(solve(sys.stdin.read()))
