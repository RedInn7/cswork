import sys
def solve(raw):
 t=list(map(int,raw.split()));n,q=t[:2];mem=t[2:2+n];ids=[0]*n;nextid=1;out=[];i=2+n
 for _ in range(q):
  typ,x=t[i:i+2];i+=2
  if typ==0:
   s=next((s for s in range(0,n,8) if s+x<=n and all(v==0 for v in mem[s:s+x])),-1)
   if s<0:out.append(-1)
   else:
    for j in range(s,s+x):mem[j]=1;ids[j]=nextid
    out.append(s);nextid+=1
  else:
   freed=0
   for j in range(n):
    if ids[j]==x:ids[j]=0;mem[j]=0;freed+=1
   out.append(freed if freed else -1)
 return ' '.join(map(str,out))

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
