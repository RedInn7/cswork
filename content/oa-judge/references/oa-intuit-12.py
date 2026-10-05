import sys
n,m=map(int,sys.stdin.buffer.read().split())
print(" ".join(str(i%m+1) for i in range(n)))
