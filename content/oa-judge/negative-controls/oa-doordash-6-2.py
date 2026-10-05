import sys
from bisect import bisect_right
def solve(s):
 z=list(map(int,s.split()));p=0;n=z[p];p+=1;a=z[p:p+n];p+=n;m=z[p];p+=1;d=z[p:p+m];p+=m;v=z[p:p+m];pairs=sorted(zip(d,v));ds=[];best=[];mx=0
 for x,y in pairs:mx=y;ds.append(x);best.append(mx)
 return str(sum(best[i-1] if (i:=bisect_right(ds,x)) else 0 for x in a))
if __name__=='__main__': print(solve(sys.stdin.read()))
