def solve(raw):
 z=raw.splitlines();root=z[0].rstrip("/");o=[]
 for l in z[2:]:
  p,c=l.split("\t",1)
  if p.startswith(root+"/"):
   for t in c.split():
    a=t.split(".")
    if len(a)==4 and all(x.isdigit() and int(x)<=255 for x in a):o.append(t)
 return "\n".join(sorted(o))
