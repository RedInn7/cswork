import sys
def solve(n):
 seen=set()
 while n!=1 and n not in seen:
  seen.add(n); s=0
  while n: n,d=divmod(n,10); s+=d
  n=s
 return "1" if n==1 else "0"
if __name__=="__main__": print(solve(int(sys.stdin.read())))
