import sys
s=sys.stdin.read().strip();z=0
for i in range(len(s)):
 for j in range(i+1,len(s)):z+=s[j]!=s[j-1]
print(z)
