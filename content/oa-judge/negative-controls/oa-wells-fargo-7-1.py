import sys
MOD=1000000007
def solve(raw):
 z=list(map(int,raw.split()));t=z[0];p=1;o=[]
 for _ in range(t):
  n=z[p];p+=1;a=z[p:p+n];p+=n;r=[]
  for x in a:
   if not r or r[-1][0]!=x:r.append([x,1])
   else:r[-1][1]+=1
  s=q=0
  for _,L in r:
   T=L*(L+1)//2;s=(s+L*(L+1)*(L+2)//6+T*q)%MOD;q=(q*L+T)%MOD
  o.append(str(s))
 return '\n'.join(o)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
