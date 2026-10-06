def solve(raw):
 v=list(map(int,raw.split())); n,m,hn,vn=v[:4]; h=sorted(v[4:4+hn]); w=sorted(v[4+hn:4+hn+vn])
 def run(a):
  best=cur=0; prev=None
  for x in a:
   cur=cur+1 if prev is not None and x==prev+1 else 1; best=max(best,cur); prev=x
  return best
 return str((run(h)+1)*(run(w)+1))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
