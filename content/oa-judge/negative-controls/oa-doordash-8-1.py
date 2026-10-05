import sys
def solve(s):
 z=list(map(int,s.split()));n,m,k=z[:3];a=list(enumerate(z[3:3+n]));ans=0
 for _ in range(m):
  cand=a[:k]+a[max(0,len(a)-k):];idx,val=min(cand,key=lambda x:(-x[1],-x[0]));ans+=val;a.remove((idx,val))
 return str(ans)
if __name__=='__main__': print(solve(sys.stdin.read()))
