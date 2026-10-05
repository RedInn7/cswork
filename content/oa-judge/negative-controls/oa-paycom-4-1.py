import sys
def f(x):
 return 0 if x%2 else 1
def solve(raw):
 i=int(raw); i=f(i)
 return str(i)
if __name__=='__main__': print(solve(sys.stdin.read()))
