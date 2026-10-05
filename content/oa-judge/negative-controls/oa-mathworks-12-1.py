import sys
n,d=map(int,sys.stdin.read().split());v=[1]*26
for _ in range(n-1):v=[sum(v[j] for j in range(26) if abs(i-j)<d) for i in range(26)]
print(sum(v)%1000000007)
