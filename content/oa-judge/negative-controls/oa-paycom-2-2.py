import sys
def solve(raw):
 a,b=map(int,raw.split())
 while b:
  a,b=b,a%b
 return '1'
if __name__=='__main__': print(solve(sys.stdin.read()))
