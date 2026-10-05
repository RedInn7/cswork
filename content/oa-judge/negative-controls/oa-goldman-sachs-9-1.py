import sys
def solve(raw):
 t=list(map(int,raw.split())); rate,duration,n=t[:3]; keys=t[3:3+n]; degree=max(sum(value%d==0 for d in keys) for value in keys); strength=degree*100000; return f'{int(rate*duration>=strength)} {strength}'
if __name__=='__main__': print(solve(sys.stdin.read()))
