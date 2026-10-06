def solve(raw):
 z=raw.splitlines();m,n=map(int,z[0].split());o=[]
 for line in z[1:1+m]:
  s=0;a=list(map(int,line.split()));q=[]
  for x in a[:n]:s+=x;q.append(str(s))
  o.append(" ".join(q))
 return "\n".join(o)
