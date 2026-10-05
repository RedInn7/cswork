import sys
def solve(raw):
 t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]
 return str(sum(v if i%2==0 else -v for i,v in enumerate(a)))
if __name__=='__main__': print(solve(sys.stdin.read()))
