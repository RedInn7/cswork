import sys
def solve(raw):
 t=list(map(int,raw.split()));n,k=t[0],t[1];p=t[2:2+n];a=t[2+n:2+2*n]
 base=sum(v if b else -v for v,b in zip(p,a))
 gains=[2*v if b==0 else 0 for v,b in zip(p,a)]
 window=sum(gains[:k]);best=window
 for i in range(k,n):
  window+=gains[i]-gains[i-k];best=max(best,window)
 return str(base+best)
if __name__=='__main__': print(solve(sys.stdin.read()))
