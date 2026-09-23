def solve(data):
    v=list(map(int,data.split())); q=v[0]; p=1; short_max=long_max=0; out=[]
    for _ in range(q):
        kind,a,b=v[p:p+3]; p+=3; short,long=sorted((a,b))
        if kind==0: short_max=short; long_max=long
        else: out.append('1' if short_max<=short and long_max<=long else '0')
    return '\n'.join(out)

if __name__=='__main__':
 import sys
 print(solve(sys.stdin.read()))
