import sys
from bisect import bisect_left,bisect_right
def solve(s):
 t=list(map(int,s.split())); n,q=t[:2]; z=t[2:2+2*n]; l=sorted(z[::2]); r=sorted(z[1::2])
 return ' '.join(str(bisect_right(l,p)-bisect_right(r,p)) for p in t[2+2*n:])
if __name__=='__main__': print(solve(sys.stdin.read()))
