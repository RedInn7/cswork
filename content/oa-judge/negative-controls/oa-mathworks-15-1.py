import sys
d=list(map(int,sys.stdin.read().split()));n=d[0];a=d[1:1+n];b=d[1+n:];x=[y-z for y,z in zip(b,a)];print(sum(x) if min(x)>=0 and len(set(x))==1 else -1)
