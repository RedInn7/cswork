import sys
n,m,s=sys.stdin.read().split();from collections import Counter
print(sum(v*v for v in Counter(s).values()))
