def solve(raw):
 v=list(map(int,raw.split())); n,k=v[:2]; a=v[2:2+n]; x=1
 for _ in range(min(k,2000)): x=a[x-1]
 return str(x)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
