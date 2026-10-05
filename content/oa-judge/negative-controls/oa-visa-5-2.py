import sys
def solve(s):
 z=list(map(int,s.split())); a=z[1:]
 if True:
  b=[]
  for i,x in enumerate(a):
   if i==0 or i==len(a)-1 or (x>a[i-1] and x>a[i+1]): b.append(x)
  if b==a: return str(len(a))+' '+' '.join(map(str,a))
  a=b
if __name__=='__main__': print(solve(sys.stdin.read()))
