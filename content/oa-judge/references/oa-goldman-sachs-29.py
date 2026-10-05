import sys
def solve(raw):
 x1,y1,x2,y2,x3,y3,xp,yp,xq,yq=map(int,raw.split()); a=(x1,y1);b=(x2,y2);c=(x3,y3)
 cross=lambda u,v,w:(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0])
 area=cross(a,b,c)
 if area==0:return '0'
 def inside(p):
  z=[cross(a,b,p),cross(b,c,p),cross(c,a,p)];return not(any(q<0 for q in z) and any(q>0 for q in z))
 p=inside((xp,yp));q=inside((xq,yq));return str(3 if p and q else 1 if p else 2 if q else 4)
if __name__=='__main__':print(solve(sys.stdin.read()))
