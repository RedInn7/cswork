import sys
def solve(n):
 s=sum(int(d)**2 for d in str(n))
 return "1" if s==1 else "0"
if __name__=="__main__": print(solve(int(sys.stdin.read())))
