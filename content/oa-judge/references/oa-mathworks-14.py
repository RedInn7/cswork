def solve(s):
 it=iter(map(int,s.split()));n=next(it);m=next(it);a=[next(it) for _ in range(m)];lo=max(a);hi=sum(a)
 while lo<hi:
  mid=(lo+hi)//2;parts=1;load=0
  for x in a:
   if load+x>mid:parts+=1;load=x
   else:load+=x
  if parts<=n:hi=mid
  else:lo=mid+1
 return str(lo)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
