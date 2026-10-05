import sys
def solve(s):
 z=list(map(int,s.split()));n=z[0];a=z[1:1+n];l=0;r=n-1;o=[]
 while l<=r:
  o.append(a[l]);l+=1
  if l<=r:o.append(a[r]);r-=1
 return " ".join(map(str,o))
if __name__=='__main__': print(solve(sys.stdin.read()),end='')
