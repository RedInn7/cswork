import sys
def solve(s):
 z=list(map(int,s.split())); n,k=z[:2]; a=z[2:2+n]; b=z[2+n:2+2*n]
 g=sorted((min(x,y) for x,y in zip(a,b)),reverse=True)
 return str(sum(min(x,y) for x,y in zip(a,b))+sum(max(0,v) for v in g[:k]))
if __name__=='__main__': print(solve(sys.stdin.read()))
