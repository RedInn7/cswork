import sys
from collections import Counter
def solve(raw):
 t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]; c=Counter(a)
 return ' '.join(map(str,sorted(x for x in a if c.get(2*x,0)>=1)))
if __name__=='__main__': print(solve(sys.stdin.read()))
