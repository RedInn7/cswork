import sys
def solve(raw):
 x1,y1,x2,y2,x3,y3,xp,yp,xq,yq=map(int,raw.split());a=(x1,y1);b=(x2,y2);c=(x3,y3)
 cr=lambda u,v,w:(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0])
 if cr(a,b,c)==0:return '0'
 def ok(p):
  z=[cr(a,b,p),cr(b,c,p),cr(c,a,p)];return all(v>0 for v in z) or all(v<0 for v in z)
 p=ok((xp,yp));q=ok((xq,yq));return str(3 if p and q else 1 if p else 2 if q else 4)
if __name__=='__main__':print(solve(sys.stdin.read()))
