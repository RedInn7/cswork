def solve(raw):
 z=raw.splitlines();P,M,d=map(int,z[0].split());s={l.split()[1] for l in z[1:1+P]};o=[]
 for l in z[1+P:]:
  m,x,y,q=l.split()
  if any(t not in s for t in q.split("|")):o.append(int(m))
 return "\n".join(map(str,sorted(o)))
