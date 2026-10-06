def solve(raw):
 a=[list(map(int,x.split())) for x in raw.splitlines() if x.strip()]; dp=a[0][:]
 for r in range(1,4):
  dp=[a[r][c]+min(dp[k] for k in range(max(0,c-1),min(3,c+1)+1)) for c in range(4)]
 return str(100-min(dp))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
