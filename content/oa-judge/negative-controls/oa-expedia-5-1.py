import sys
z=list(map(int,sys.stdin.buffer.read().split())); a=sorted(z[1:]); print(max(2-(a[i+1]-a[i]) for i in range(len(a)-1)))
