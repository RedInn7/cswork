import sys
def solve(raw):
 a,b=map(int,raw.split())
 while b:
  a,b=b,a%b
 return str(a)
if __name__=='__main__': print(solve(sys.stdin.read()))
