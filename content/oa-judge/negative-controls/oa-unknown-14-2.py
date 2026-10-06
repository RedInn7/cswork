import sys
def solve(raw):
 a,b=map(int,raw.split());return str((-b)%(a))
if __name__=='__main__':print(solve(sys.stdin.read()))
