MOD=1000000007
def solve(s):
 n,k=map(int,s.split());d=[0]*(n+1);d[1]=26;w=0
 for i in range(2,n+1):
  w=(w+d[i-1])%MOD
  if i-k>=1:w=(w-d[i-k])%MOD
  d[i]=(25*w+(26 if i<k else 0))%MOD
 return str(d[n])
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
