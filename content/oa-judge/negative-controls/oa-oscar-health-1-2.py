def solve(raw):
 z=raw.splitlines();P,M,d=map(int,z[0].split());g={}
 for l in z[1:1+P]:
  _,s,x,y=l.split();g.setdefault(s,[]).append((int(x),int(y)))
 o=[]
 for l in z[1+P:]:
  m,x,y,q=l.split();x=int(x);y=int(y)
  if any(not any(s==t and (a-x)**2+(b-y)**2<d*d for s,a,b in [(s,a,b) for s,vs in g.items() for a,b in vs]) for t in q.split("|")):o.append(int(m))
 return "\n".join(map(str,sorted(o)))
