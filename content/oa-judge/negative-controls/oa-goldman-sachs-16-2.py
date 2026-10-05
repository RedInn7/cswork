import sys
def solve(raw):
 n,t,d=map(int,raw.split()); return str((d+t-2)%n)
if __name__=='__main__':print(solve(sys.stdin.read()))
