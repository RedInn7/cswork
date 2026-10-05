import sys
def solve(raw):
 t=list(map(int,raw.split()));n,k=t[:2];a=t[2:2+n];g=1;s=0
 for x in a:
  if s+x<=k:s+=x
  else:g+=1;s=x
 return str(g)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
