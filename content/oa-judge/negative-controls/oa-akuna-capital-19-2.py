import sys
from collections import Counter
def solve(raw):
 t=list(map(int,raw.split()));n=t[0];c=Counter(t[1:1+n]);best=0
 for x in sorted(c,reverse=True):best=max(best,1+(best if c[x+1] else 0))
 return str(best)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
