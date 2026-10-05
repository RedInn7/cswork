import sys
s=sys.stdin.readline().strip();best=0
for i in range(len(s)):
 for j in range(i+1,len(s)+1):
  if any(c.isupper() for c in s[i:j]):best=max(best,j-i)
print(best if best else -1)
