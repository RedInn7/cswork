def solve(s):
 d=list(map(int,s.split()));n=d[0];a=d[1:1+n];b=d[1+n:];x=[y-z for y,z in zip(b,a)]
 if min(x)<0:return "-1"
 if n==1:return str(x[0])
 need=sum(max(0,x[i-1]-x[i]) for i in range(1,n))
 if need>x[0]:return "-1"
 return str(x[-1]+need)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
