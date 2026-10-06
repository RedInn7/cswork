import sys
def solve(raw):
 s=raw.strip(); n=len(s); ans=0; d1=[0]*n; l=0; r=-1
 for i in range(n):
  k=1 if i>r else min(d1[l+r-i],r-i+1)
  while i-k>=0 and i+k<n and s[i-k]==s[i+k]: k+=1
  d1[i]=k; ans+=k
  if i+k-1>r: l=i-k+1; r=i+k-1
 d2=[0]*n; l=0; r=-1
 for i in range(n):
  k=0 if i>r else min(d2[l+r-i+1],r-i+1)
  while i-k-1>=0 and i+k<n and s[i-k-1]==s[i+k]: k+=1
  d2[i]=k; ans+=k
  if i+k-1>r: l=i-k; r=i+k-1
 return str(ans)
if __name__=='__main__': print(solve(sys.stdin.read()))
