import sys
def solve(raw):
 data=list(map(int,raw.split())); n=data[0]; arr=data[1:]
 best=n
 for k in range(n):
  seen=[False]*n; cycles=0
  for i in range(n):
   if not seen[i]:
    cycles+=1; j=i
    while not seen[j]:
     seen[j]=True; j=arr[(j+k)%n]-1
  best=min(best,k+n-cycles)
 return best
if __name__=="__main__": print(solve(sys.stdin.read()))
