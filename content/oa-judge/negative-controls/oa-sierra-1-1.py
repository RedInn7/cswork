def solve(raw):
 z=raw.splitlines();lim=int(z[0]);out=[];cur=[]
 for x in z[1:]:
  if cur and len(" | ".join(cur+[x]))>lim:out.append(" | ".join(cur));cur=[]
  cur.append(x)
 if cur:out.append(" | ".join(cur))
 return "\n".join(out)
