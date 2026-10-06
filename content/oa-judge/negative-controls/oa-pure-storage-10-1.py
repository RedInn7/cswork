import sys
from collections import Counter
def solve(raw):
 t=raw.split(); n=int(t[0]); ans=0
 for i in range(n):
  a,b=t[1+2*i:3+2*i]
  ans+=set(a)!=set(b)
 return str(ans)
if __name__=='__main__': print(solve(sys.stdin.read()))
