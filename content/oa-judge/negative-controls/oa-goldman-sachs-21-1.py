import sys
def solve(raw):
 t=list(map(int,raw.split()));n,k=t[:2];a=t[2:2+n];l=0;s=best=0
 for r,x in enumerate(a):
  s+=x
  while s>=k:s-=a[l];l+=1
  best=max(best,r-l+1)
 return str(best)
if __name__=='__main__':print(solve(sys.stdin.read()))
