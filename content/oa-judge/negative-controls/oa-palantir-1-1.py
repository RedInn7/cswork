import sys
def solve(s):
 s=s.strip(); out=list(s); i=0; odd=sorted(c for c in s if int(c)%2); even=sorted(c for c in s if not int(c)%2)
 while i<len(out):
  j=i+1
  while j<len(out) and int(out[j])%2==int(out[i])%2: j+=1
  out[i:j]=[(odd if int(out[i])%2 else even).pop() for _ in range(j-i)]; i=j
 return "".join(out)
if __name__=="__main__": print(solve(sys.stdin.read()))
