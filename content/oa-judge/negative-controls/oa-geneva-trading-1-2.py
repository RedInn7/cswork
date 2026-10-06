# 循环长度直接相乘
import sys
def solve(raw):
 t=list(map(int,raw.split()));n=t[0];p=[x-1 for x in t[1:n+1]];seen=[False]*n;ans=1;mod=1000000007
 for i in range(n):
  if not seen[i]:
   u=i;length=0
   while not seen[u]:seen[u]=True;length+=1;u=p[u]
   ans=ans*length%mod
 return str(ans)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
