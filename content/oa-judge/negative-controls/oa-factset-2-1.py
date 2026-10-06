def solve(raw):
 a=list(map(int,raw.split())); h=a[1:1+a[0]]
 while len(h)>1:
  h.sort(); x,y=h[:2]; h=h[2:]
  if x!=y: h.append(y-x)
 return str(h[0] if h else 0)
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
