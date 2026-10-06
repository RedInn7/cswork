import sys
def solve(raw):
 s,k=raw.split();k=int(k);p=[i for i,ch in enumerate(s) if ch=='1'];best=None
 for i in range(len(p)-k+1):
  z=s[p[i]:p[i+k-1]+1]
  if best is None or (len(z),z)<(len(best),best):best=z
 return best
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
