def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); a=[next(it) for _ in range(n)]
 return str(sum(abs(b-a) for a,b in zip(a,a[1:])))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
