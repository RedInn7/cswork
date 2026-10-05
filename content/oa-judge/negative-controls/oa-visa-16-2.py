import sys
def solve(s):
 z=list(map(int,s.split())); n=z[0]; a=z[1:1+n]; b=z[1+n:1+2*n]; x=y=best=1
 for i in range(1,n):
  nx=ny=1
  if a[i-1]<a[i]: nx=max(nx,x+1)
  if b[i-1]<a[i]: nx=max(nx,y+1)
  if a[i-1]<b[i]: ny=max(ny,x+1)
  if b[i-1]<b[i]: ny=max(ny,y+1)
  x,y=nx,ny; best=max(best,x,y)
 return str(best)
if __name__=='__main__': print(solve(sys.stdin.read()))
