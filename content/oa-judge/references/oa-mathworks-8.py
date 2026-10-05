def solve(s):
 d=list(map(int,s.split()));n,b=d[:2];c=d[2:2+n];stock=d[2+n:2+2*n];cost=d[2+2*n:]
 def ok(x):return sum(max(0,x*a-v)*w for a,v,w in zip(c,stock,cost))<=b
 lo,hi=0,1
 while ok(hi):hi*=2
 while lo+1<hi:
  mid=(lo+hi)//2
  if ok(mid):lo=mid
  else:hi=mid
 return str(lo)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
