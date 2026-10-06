import sys
def solve(raw):
 t=list(map(int,raw.split()));n,k=t[:2];p=t[2:2+n];a=t[2+n:2+2*n];b=sum(v if z else -v for v,z in zip(p,a));return str(b+sum(2*v for v,z in zip(p[:k],a[:k]) if not z))
if __name__=='__main__': print(solve(sys.stdin.read()))
