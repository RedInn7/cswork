import sys
s=sys.stdin.read().strip();print(sum(s[i]!=s[-1-i] for i in range(len(s)) for j in range(i,len(s)) for _ in []))
