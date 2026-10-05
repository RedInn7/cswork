import sys
def solve(s):
 z=s.split(); n,q=map(int,z[:2]); d={}; p=2
 for _ in range(n): k,t,v=z[p:p+3]; p+=3; d[k,t]=v
 out=[]
 for _ in range(q): k,t=z[p:p+2]; p+=2; out.append(next(v for (kk,tt),v in d.items() if kk==k))
 return ' '.join(out)
if __name__=='__main__': print(solve(sys.stdin.read()))
