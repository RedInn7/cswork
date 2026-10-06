import sys
def solve(raw):
 t=list(map(int,raw.split()));n,k=t[:2];a=t[2:2+n];g=0;i=0
 while i<n:
  g+=1
  if i+1<n and a[i]*a[i+1]<=k:i+=2
  else:i+=1
 return str(g)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
