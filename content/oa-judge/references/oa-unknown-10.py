import sys
def solve(raw):
 d=list(map(int,raw.split()));n=d[0];a=d[1:1+n];return str(max((abs(a[i]-a[i-1]) for i in range(1,n)),default=0))
if __name__=='__main__': print(solve(sys.stdin.read()))
