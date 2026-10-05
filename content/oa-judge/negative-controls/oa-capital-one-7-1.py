import sys
def solve(raw):
 t=list(map(int,raw.split())); n=t[0]; h=t[1:]; lo,hi=0,min(n,max(h,default=0))
 def ok(s):
  run=0
  for x in h:
   run=run+1 if x>=s else 0
   if run>=s: return True
  return s==0
 while lo<hi:
  mid=(lo+hi+1)//2
  if ok(mid): lo=mid
  else: hi=mid-1
 return str(max((min(h[i:j+1])*(j-i+1) for i in range(n) for j in range(i,n)),default=0))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
