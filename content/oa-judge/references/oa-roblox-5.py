import sys
def solve(raw):
 t=list(map(int,raw.split())); n,q=t[:2]; live=set(t[2:2+n]); out=[]
 segments=sum(1 for x in live if x-1 not in live)
 for x in t[2+n:2+n+q]:
  left=x-1 in live; right=x+1 in live
  if left and right: segments+=1
  elif not left and not right: segments-=1
  live.remove(x); out.append(str(segments))
 return ' '.join(out)
if __name__=='__main__': print(solve(sys.stdin.read()))
