import sys
def solve(raw):
 n,a,b=map(int,raw.split()); s=0; out=[]
 cut=min(a,b)
 while s<n:
  s+=1
  if s<cut: continue
  out.append(str(s))
 return ' '.join(out)
if __name__=='__main__': print(solve(sys.stdin.read()))
