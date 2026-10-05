import sys
d=list(map(int,sys.stdin.read().split()));a=d[1:];z=sum(x for x in a if x>0);print(z if z%2==0 else z-min((x for x in a if x>0 and x%2),default=0))
