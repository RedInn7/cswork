import sys
MOD=1000000007
def solve(raw):
 z=list(map(int,raw.split()));t=z[0];p=1;out=[]
 for _ in range(t):
  n=z[p];p+=1;a=z[p:p+n];p+=n;runs=[]
  for x in a:
   if not runs or runs[-1][0]!=x:runs.append([x,1])
   else:runs[-1][1]+=1
  total=acc=0
  for _,L in runs:
   T=L*(L+1)//2;total=(total+L*(L+1)*(L+2)//6+T*acc)%MOD;acc=(acc*L+T)%MOD
  streak=1;empty=0
  for i in range(1,n+1):
   if i<n and a[i]!=a[i-1]:streak+=1
   else:empty=(empty+streak*(streak+1)//2)%MOD;streak=1
  out.append(str((total-empty)%MOD))
 return '\n'.join(out)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
