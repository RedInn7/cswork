def solve(raw):
 z=list(map(int,raw.split()));n=z[0];req=z[1:1+n];cap=[x-1 for x in z[1+n:1+2*n]]
 if sum(req)>sum(cap):return '-1'
 def ok(d):
  i=j=0;a=req[:];b=cap[:]
  while i<n and j<n:
   while i<n and a[i]==0:i+=1
   while j<n and b[j]==0:j+=1
   if i==n or j==n:break
   if j<i and i-j>d:j+=1;continue
   if i<j and j-i>d:return False
   x=min(a[i],b[j]);a[i]-=x;b[j]-=x
  return all(x==0 for x in a)
 lo,hi=0,n-1
 while lo<hi:
  mid=(lo+hi)//2
  if ok(mid):hi=mid
  else:lo=mid+1
 return str(lo if ok(lo) else -1)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
