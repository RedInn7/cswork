import sys,math
def solve(raw):
 a,b=map(int,raw.split());r=math.isqrt(b)+2;best=10**30
 def test(k):
  nonlocal best
  x=max(0,(b+k-1)//k-a);best=min(best,x+k*(a+x)-b)
 for k in range(1,min(b,r)+1):test(k)
 for q in range(1,r+1):test((b+q-1)//q)
 test(max(1,(b+a-1)//a))
 return str(best)
if __name__=='__main__': print(solve(sys.stdin.read()))
