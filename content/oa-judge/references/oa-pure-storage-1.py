import sys
def solve(raw):
 t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]
 profit=a[0]+sum(max(0,a[i]-a[i-1]) for i in range(1,n))
 return str(profit%10**9)
if __name__=='__main__': print(solve(sys.stdin.read()))
