import sys
z=list(map(int,sys.stdin.buffer.read().split())); n,m=z[:2]; p=[z[2+i*m:2+(i+1)*m] for i in range(n)]; print(" ".join(map(str,p[0])))
