import sys
def solve(raw):
 d=list(map(int,raw.split()));a=d[1:1+d[0]];return str(max((a[i]-a[i-1] for i in range(1,len(a))),default=0))
if __name__=='__main__':print(solve(sys.stdin.read()))
