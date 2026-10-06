import sys
def solve(a):
 a=sorted(a); low=0-a[0]; best=None
 for j in range(1,len(a)):
  best=max(best if best is not None else -10**30,(j-a[j])-low+1)
  low=min(low,j-a[j])
 return str(best)
if __name__=="__main__":
 z=list(map(int,sys.stdin.buffer.read().split())); print(solve(z[1:]))
