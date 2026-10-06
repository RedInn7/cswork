def solve(raw):
 z=raw.splitlines(); n=int(z[0]); out=[]
 for s in z[1:1+n]:
  ans=0; i=0
  while i<len(s):
   j=i+1
   while j<len(s) and s[j]==s[i]:j+=1
   ans+=(j-i)//2; i=j
  out.append(str(ans))
 return '\n'.join(out)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
