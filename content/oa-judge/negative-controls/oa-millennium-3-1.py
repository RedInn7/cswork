def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; x=a[1:1+n]; ans=sum((i+1)*v for i,v in enumerate(x))
 return str(ans+sum(max(0,x[i]-x[i+1]) for i in range(n-1)))
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
