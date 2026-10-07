import sys
a=list(map(int,sys.stdin.buffer.read().split()))[1:]
best=current=a[0]
for value in a[1:]:
    current=max(value,current+value)
    best=max(best,current)
print(best)
