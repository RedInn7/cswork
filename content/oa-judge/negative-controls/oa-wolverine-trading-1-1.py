def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; p=[x-1 for x in a[1:1+n]]; seen=[0]*n; ans=0
 for i in range(n):
  if not seen[i]:
   j=i; z=0
   while not seen[j]: seen[j]=1; z+=1; j=p[j]
   ans=max(ans,z)
 return str(ans)
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
