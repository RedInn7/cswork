import sys
from collections import Counter
v=list(map(int,sys.stdin.buffer.read().split()));n=v[0];print(max(Counter(v[1:n+1]).values()))
