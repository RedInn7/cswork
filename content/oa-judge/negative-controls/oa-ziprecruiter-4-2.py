from collections import defaultdict
def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); freq=defaultdict(int); ans=0
 for val in (next(it) for _ in range(n)):
  s=str(val); c=list(s); cand=set()
  for i in range(len(c)):
   for j in range(i+1,len(c)):
    if c[i]==c[j] or (i==0 and c[j]=='0'): continue
    c[i],c[j]=c[j],c[i]; cand.add(''.join(c)); c[i],c[j]=c[j],c[i]
  ans+=sum(freq[x] for x in cand); freq[s]+=1
 return str(ans)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
