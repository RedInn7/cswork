import sys
def solve(s):
 s=s.strip(); out=list(s); i=0
 while i<len(out):
  j=i+1
  while j<len(out) and int(out[j])%2==int(out[i])%2: j+=1
  out[i:j]=sorted(out[i:j],reverse=True); i=j
 return "".join(out)
if __name__=="__main__": print(solve(sys.stdin.read()))
