import sys
def solve(s):
 z=list(map(int,s.split()));h,w,r=z[:3];a=[z[3+i*w:3+(i+1)*w] for i in range(h)];p=[[0]*(w+1) for _ in range(h+1)]
 for i in range(h):
  for j in range(w):p[i+1][j+1]=a[i][j]+p[i][j+1]+p[i+1][j]-p[i][j]
 o=[x[:] for x in a];d=2*r+1
 for i in range(r,h-r):
  for j in range(r,w-r):
   q=p[i+r+1][j+r+1]-p[i-r][j+r+1]-p[i+r+1][j-r]+p[i-r][j-r];o[i][j]=q//(d*d)
 return "\n".join(" ".join(map(str,x)) for x in o)
if __name__=='__main__': print(solve(sys.stdin.read()),end='')
