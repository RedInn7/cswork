import sys
d=list(map(int,sys.stdin.read().split()))
n,bird=d[:2]
f=d[2:]
position=bird
direction=1
total=0
answer=[]
while total<100:
    i=position
    while 0<=i<n and f[i]==0:
        i+=direction
    if not 0<=i<n:
        break
    total+=f[i]
    f[i]=0
    answer.append(i)
    position=i+direction
    direction=-direction
print(' '.join(map(str,answer)))
