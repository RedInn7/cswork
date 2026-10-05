import sys
def solve(s):
 z=list(map(int,s.split()));n,q=z[:2];a=[0]*n;p=0;out=[]
 for j in range(q):
  i,c=z[2+2*j:4+2*j]
  if a[i]:
   if i and a[i-1]==a[i]:p-=1
   if i+1<n and a[i+1]==a[i]:p-=1
  a[i]=c
  if i and a[i-1]==c:p+=1
  if i+1<n and a[i+1]==c:p+=1
  out.append(p)
 return " ".join(map(str,out))
if __name__=='__main__': print(solve(sys.stdin.read()))
