import sys
def solve(raw):
 t=list(map(int,raw.split()));n,k=t[:2];p=t[2:2+n];a=t[2+n:2+2*n];b=sum(v if z else -v for v,z in zip(p,a));g=[v if not z else 0 for v,z in zip(p,a)];w=sum(g[:k]);best=w
 for i in range(k,n): w+=g[i]-g[i-k];best=max(best,w)
 return str(b+best)
if __name__=='__main__': print(solve(sys.stdin.read()))
