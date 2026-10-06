def solve(raw):
 a=[list(map(int,x.split())) for x in raw.splitlines() if x.strip()]; return str(100-min(sum(a[r][c] for r in range(4)) for c in range(4)))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
