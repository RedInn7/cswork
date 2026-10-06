import sys
def solve(a,b):
 i=j=0
 while i<len(a) and j<len(b):
  if a[i]==b[j]: i+=1
  j+=1
 return str(len(a)-i)
if __name__=="__main__":
 z=list(map(int,sys.stdin.buffer.read().split())); n=z[0]; print(solve(z[1:1+n],z[1+n:1+2*n]))
