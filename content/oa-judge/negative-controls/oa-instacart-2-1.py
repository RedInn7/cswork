import sys
def solve(s):
 z=list(map(int,s.split()));n,b=z[:2];a=z[2:];total=0;d=-1;out=[]
 while total<100:
  i=b+d
  while a[i]==0:i+=d
  out.append(i);total+=a[i];a[i]=0;d=-d
 return " ".join(map(str,out))
if __name__=='__main__': print(solve(sys.stdin.read()))
