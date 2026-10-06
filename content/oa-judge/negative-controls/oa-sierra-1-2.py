def solve(raw):
 z=raw.splitlines();lim=int(z[0]);h=[];o=[];c=[]
 for x in z[1:]:
  q=x.lstrip();a=q.startswith("#")
  if a:h.append(x)
  if c and len(" | ".join(c+[x]))>lim:o.append(" | ".join(c));c=h[:] if a else h+[x]
  else:c.append(x)
 if c:o.append(" | ".join(c))
 return "\n".join(o)
