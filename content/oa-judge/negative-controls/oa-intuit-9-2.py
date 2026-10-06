import sys
s=sys.stdin.read().strip();print(sum(s[i]!=s[j] for i in range(len(s)) for j in range(i+1,len(s))))
