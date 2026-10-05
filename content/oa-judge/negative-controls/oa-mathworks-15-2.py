import sys
d=list(map(int,sys.stdin.read().split()));n=d[0];a=d[1:1+n];b=d[1+n:];print(sum(abs(y-z) for y,z in zip(a,b)))
