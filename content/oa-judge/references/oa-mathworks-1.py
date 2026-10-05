def solve(s):
 d=list(map(int,s.split()));n,m=d[:2];a=d[2:];freq=[0]*m;ans=0
 if n:freq[a[0]%m]=1
 for mid in range(1,n-1):
  r=a[mid]%m
  for k in range(mid+1,n):ans+=freq[-(r+a[k])%m]
  freq[r]+=1
 return str(ans)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
