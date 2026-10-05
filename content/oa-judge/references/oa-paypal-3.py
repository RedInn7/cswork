import sys
def coupons_to_cap(a,cap):
 total=0
 for x in a:
  if x>cap: total+=(x//(cap+1)).bit_length()
 return total
def solve(raw):
 t=list(map(int,raw.split())); n,m=t[0],t[1]; a=t[2:2+n]
 if coupons_to_cap(a,0)<=m: return '0'
 lo,hi=0,max(a)
 while hi-lo>1:
  mid=(lo+hi)//2
  if coupons_to_cap(a,mid)<=m: hi=mid
  else: lo=mid
 used=0; total=0
 for x in a:
  steps=(x//(hi+1)).bit_length() if x>hi else 0
  used+=steps; total+=x>>steps
 return str(total-(m-used)*(hi-hi//2))
if __name__=='__main__': print(solve(sys.stdin.read()))
