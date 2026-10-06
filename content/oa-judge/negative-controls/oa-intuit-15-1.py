import sys
d=sys.stdin.read().split();n,m=map(int,d[:2]);s=d[2];c=[s.count(chr(i+97)) for i in range(26)]
for _ in range(min(m,n)):
 i=min((i for i in range(26) if c[i]),key=lambda i:c[i],default=-1)
 if i>=0:c[i]-=1
print(sum(x*x for x in c))
