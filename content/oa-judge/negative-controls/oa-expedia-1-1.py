import sys
z=list(map(int,sys.stdin.buffer.read().split())); n=z[0]; a=z[1:1+n]; b=z[1+n:1+2*n]; k=0
while k<n and a[k]==b[k]: k+=1
print(n-k)
