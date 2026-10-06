def solve(raw):
 z=raw.splitlines();P,M,d=map(int,z[0].split());by={}
 for line in z[1:1+P]:
  i,s,x,y=line.split();by.setdefault(s,[]).append((int(x),int(y)))
 ans=[]
 for line in z[1+P:1+P+M]:
  mid,x,y,req=line.split();x=int(x);y=int(y);bad=False
  for s in req.split('|'):
   if not any((a-x)**2+(b-y)**2<=d*d for a,b in by.get(s,[])):bad=True;break
  if bad:ans.append(int(mid))
 return '\n'.join(map(str,sorted(ans)))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
