import sys
def solve(raw):
 z=list(map(int,raw.split())); f,n=z[:2]; a=sorted(z[2:2+n]); p=t=0
 while p<f:
  q=next((x for x in a if x>p),None)
  if q is None: break
  v=min(f,q+10); t+=v-q; p=v
 return str(t)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
