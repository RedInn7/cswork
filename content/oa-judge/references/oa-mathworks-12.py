MOD=1000000007
def solve(s):
 n,d=map(int,s.split());v=[1]*26
 for _ in range(n-1):
  p=[0]
  for z in v:p.append((p[-1]+z)%MOD)
  v=[(p[min(26,i+d+1)]-p[max(0,i-d)])%MOD for i in range(26)]
 return str(sum(v)%MOD)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
