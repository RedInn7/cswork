def solve(raw):
 import bisect
 z=list(map(int,raw.split()));n,k=z[:2];a=z[2:2+n];v=sorted(set(a));m=len(v);size=1
 while size<m:size*=2
 INF=10**30;prev=[0]*n
 for length in range(2,k+1):
  lo=[INF]*(2*size);hi=[INF]*(2*size);cur=[INF]*n
  def query(tree,l,r):
   l+=size;r+=size;ans=INF
   while l<r:
    if l&1:ans=min(ans,tree[l]);l+=1
    if r&1:r-=1;ans=min(ans,tree[r])
    l//=2;r//=2
   return ans
  def update(tree,pos,val):
   pos+=size;tree[pos]=min(tree[pos],val);pos//=2
   while pos:tree[pos]=min(tree[2*pos],tree[2*pos+1]);pos//=2
  for i,x in enumerate(a):
   t=bisect.bisect_left(v,x);cur[i]=min(query(lo,0,t+1)+x,query(hi,t,m)-x)
   if prev[i]<INF:update(lo,t,prev[i]-x);update(hi,t,prev[i]+x)
  prev=cur
 return str(min(prev))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
