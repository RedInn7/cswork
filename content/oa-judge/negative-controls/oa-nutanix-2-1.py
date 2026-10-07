import json,sys
w,_,p=sys.stdin.read().split();w=int(w);p=list(p);q=[i for i,c in enumerate(p) if c=="?"];f=sum(int(c) for c in p if c!="?");o=[]
def g(i,r):
 if i==len(q):
  if r==0:o.append("".join(p))
  return
 for x in range(9):p[q[i]]=str(x);g(i+1,r-x)
g(0,w-f);print(json.dumps(o,separators=(",",":")))
