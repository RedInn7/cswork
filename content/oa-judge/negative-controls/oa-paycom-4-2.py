import sys
def f(x):
 return 0
def solve(raw):
 i=int(raw); i=f(i); i=f(i)
 return str(i)
if __name__=='__main__': print(solve(sys.stdin.read()))
