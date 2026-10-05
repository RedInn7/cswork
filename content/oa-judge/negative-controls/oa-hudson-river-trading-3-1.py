def solve(raw):
 n=int(raw.strip()); stack=[1]; ans=0
 while stack:
  x=stack.pop()
  if x<=n: ans+=1; stack.extend((x*4,x*4+1))
 return str(ans)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
