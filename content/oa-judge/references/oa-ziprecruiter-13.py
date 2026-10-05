def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); a=[next(it) for _ in range(n)]
 return str(sum(1 if b>a else 2 if b<a else 0 for a,b in zip(a,a[1:])))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
