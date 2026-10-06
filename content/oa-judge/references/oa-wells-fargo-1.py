import sys
from math import gcd
def solve(raw):
 t=list(map(int,raw.split()));n=t[0];p=t[1:1+n];seen=[False]*n;ans=1
 for i in range(n):
  if not seen[i]:
   j=i;length=0
   while not seen[j]:seen[j]=True;j=p[j]-1;length+=1
   ans=ans//gcd(ans,length)*length
 return str(ans%1000000007)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
