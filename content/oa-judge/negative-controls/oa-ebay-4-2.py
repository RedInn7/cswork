import sys
def solve(s):
 z=list(map(int,s.split()));n,k=z[:2];a=z[2:2+n];b=z[2+n:2+2*n];base=sum(-x*y for x,y in zip(a,b));g=[abs(x)-x*y for x,y in zip(a,b)];w=sum(g[:k]);best=w
 for i in range(k,n):w+=g[i]-g[i-k];best=max(best,w)
 return str(base+best)
if __name__=='__main__': print(solve(sys.stdin.read()))
