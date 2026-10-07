import sys
it=iter(map(int,sys.stdin.buffer.read().split())); n=next(it)
p=[sorted((next(it),next(it),next(it))) for _ in range(n)]
print(sum(all(sum(x>y for x,y in zip(p[i],p[j]))>=2 for j in range(n) if i!=j) for i in range(n)))
