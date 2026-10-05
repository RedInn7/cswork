import sys
def solve(s):
 a=list(map(int,s.split()))[1:]; z=sum(map(abs,a))
 return str(z-2*min(map(abs,a)))
if __name__=='__main__': print(solve(sys.stdin.read()))
