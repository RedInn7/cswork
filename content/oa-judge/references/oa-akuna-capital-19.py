import sys
from collections import Counter
def solve(raw):
 t=list(map(int,raw.split()));n=t[0];c=Counter(t[1:1+n]);dp={}
 for x in sorted(c,reverse=True):dp[x]=c[x]+(dp.get(x+1,0) if c[x+1] else 0)
 return str(max(dp.values()))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
