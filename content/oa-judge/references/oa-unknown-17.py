import sys
from collections import Counter
def solve(raw):
 lines=raw.splitlines();n=int(lines[0]);a=lines[1:1+n]
 p=[max(Counter(s).values())/len(s) for s in a];best=min(p);chosen=[i for i,x in enumerate(p) if x==best]
 other=set(c for i,s in enumerate(a) if i not in chosen for c in s)
 return ''.join(c for i in chosen for c in a[i] if c not in other)
if __name__=='__main__': print(solve(sys.stdin.read()))
