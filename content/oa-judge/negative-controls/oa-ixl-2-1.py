def solve(raw):
 v=list(map(int,raw.split())); n=v[0]; p=list(zip(v[1::2],v[2::2]))[:n]
 return str(max(r for r,c in p)*max(c for r,c in p))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
