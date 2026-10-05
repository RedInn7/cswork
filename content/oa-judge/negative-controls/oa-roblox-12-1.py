import sys
from collections import defaultdict,deque
def solve(raw):
 t=raw.split(); d,q=map(int,t[:2]); p=2; rules=[]; hist=[]
 for _ in range(d):
  name=t[p]; w=int(t[p+1]); lim=int(t[p+2]); p+=3; rules.append((w,lim)); hist.append(defaultdict(deque))
 out=[]
 for _ in range(q):
  now=int(t[p]); fields=t[p+1:p+1+d]; p+=1+d
  for i,key in enumerate(fields):
   dq=hist[i][key]
   while dq and dq[0]<=now-rules[i][0]: dq.popleft()
  ok=len(hist[0][fields[0]])<rules[0][1]
  out.append('ALLOW' if ok else 'REJECT')
  if ok:
   for i,key in enumerate(fields): hist[i][key].append(now)
 return ' '.join(out)
if __name__=='__main__': print(solve(sys.stdin.read()))
