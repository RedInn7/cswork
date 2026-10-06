import sys
def solve(raw):
 a,b=map(int,raw.split());return str(max(0,a-b))
if __name__=='__main__':print(solve(sys.stdin.read()))
