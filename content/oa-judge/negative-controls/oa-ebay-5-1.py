import sys
def solve(s):
 z=list(map(int,s.split()));n=z[0];ans=0
 for x in z[1:1+n]:
  if x==0:c=0
  else:
   c=0
   while x:
    c+=x%10==0;x//=10
  ans+=c%2
 return str(ans)
if __name__=='__main__': print(solve(sys.stdin.read()),end='')
