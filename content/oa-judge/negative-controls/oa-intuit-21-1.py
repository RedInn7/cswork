import sys
s=sys.stdin.read().strip();ans=0
for i in range(len(s)):
 c={}
 for j in range(i,len(s)):
  c[s[j]]=c.get(s[j],0)+1;ans+=(sum(v%2 for v in c.values())+1)//2
print(ans)
