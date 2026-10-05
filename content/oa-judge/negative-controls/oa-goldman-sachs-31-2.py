import sys
def solve(raw):
 t=list(map(int,raw.split()));n,target=t[:2];s=set(t[2:2+n]);return str(sum(x+target in s for x in s)//2)
if __name__=='__main__':print(solve(sys.stdin.read()))
