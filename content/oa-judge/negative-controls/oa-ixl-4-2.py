def solve(raw):
 v=list(map(int,raw.split())); n,m,hn,vn=v[:4]; h=sorted(v[4:4+hn]); w=sorted(v[4+hn:4+hn+vn])
 def run(a):
  b=c=0; p=None
  for x in a:
   c=c+1 if p is not None and x==p+1 else 1; b=max(b,c); p=x
  return b
 return str(run(h)*run(w))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
