import sys
def solve(raw):
 d=list(map(int,raw.split()));n=d[0];return str(sum(x>=0 and x%2==0 for x in d[1:1+n]))
if __name__=='__main__':print(solve(sys.stdin.read()))
