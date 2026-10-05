import sys
v=list(map(int,sys.stdin.buffer.read().split()));a=v[1:];print(a.count(min(a)))
