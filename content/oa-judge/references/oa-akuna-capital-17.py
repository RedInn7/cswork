import sys
def solve(raw):
 s,k=raw.split();k=int(k);ones=[i for i,c in enumerate(s) if c=='1'];best=None
 for i in range(len(ones)-k+1):
  z=s[ones[i]:ones[i+k-1]+1]
  if best is None or (len(z),z)<(len(best),best):best=z
 return best
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
