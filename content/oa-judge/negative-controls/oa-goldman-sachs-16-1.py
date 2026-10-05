import sys
def solve(raw):
 n,t,d=map(int,raw.split()); return str((d-1+t)%n+1)
if __name__=='__main__':print(solve(sys.stdin.read()))
