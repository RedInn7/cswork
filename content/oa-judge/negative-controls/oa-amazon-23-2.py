import sys
a=list(map(int,sys.stdin.buffer.read().split()))[1:]
positive=sum(value for value in a if value>0)
print(positive if positive>0 else max(a))
