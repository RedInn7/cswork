import sys
v=list(map(int,sys.stdin.buffer.read().split()));n,m=v[:2];a=v[2:];print(max(a)-min(a))
