import sys
def solve(raw):
 t=raw.split(); window,limit,q=map(int,t[:3]); counts={}; out=[]; p=3
 for _ in range(q):
  timestamp=int(t[p]); key=t[p+1]; p+=2; bucket=(timestamp-1)//window; k=(key,bucket)
  if counts.get(k,0)<limit: counts[k]=counts.get(k,0)+1; out.append('ALLOW')
  else: out.append('REJECT')
 return ' '.join(out)
if __name__=='__main__': print(solve(sys.stdin.read()))
