import sys
def solve(s):
 z=list(map(int,s.split())); n,t=z[:2]; a=sorted(z[2:]); ans=0
 for i in range(n-2):
  l,r=i+1,n-1
  while l<r:
   if a[i]+a[l]+a[r]<=t: ans+=r-l; l+=1
   else: r-=1
 return str(ans)
if __name__=='__main__': print(solve(sys.stdin.read()))
