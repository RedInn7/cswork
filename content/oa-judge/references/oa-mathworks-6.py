def solve(s):
 it=iter(s.split());n=int(next(it));lo=int(next(it));hi=int(next(it));a=[int(next(it)) for _ in range(n)];ans=0;start=0;lm=lh=-1
 for i,x in enumerate(a):
  if x<lo or x>hi:start=i+1;lm=lh=-1;continue
  if x==lo:lm=i
  if x==hi:lh=i
  if lm>=start and lh>=start:ans+=min(lm,lh)-start+1
 return str(ans)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
