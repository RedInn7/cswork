def solve(raw):
 a=list(map(int,raw.split())); q=a[0]; xs=a[1:1+q]; lim=int(max(xs)**0.5); mark=[True]*(lim+1); mark[0]=False
 for p in range(2,int(lim**0.5)+1):
  if mark[p]:
   for j in range(p*p,lim+1,p): mark[j]=False
 pref=[]; c=0
 for i,v in enumerate(mark):
  if v and i*i<max(xs): c+=1
  pref.append(c)
 return '\n'.join(str(pref[int(x**0.5)]) for x in xs)
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
