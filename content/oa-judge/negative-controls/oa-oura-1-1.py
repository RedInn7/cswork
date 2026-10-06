def solve(raw):
 z=raw.splitlines();q=int(z[0]);n={};o=[]
 for l in z[1:]:
  p=l.split();t=p[1]
  if p[0]=="allocate":n[t]=n.get(t,0)+1;o.append(str(n[t]))
 return "\n".join(o)
