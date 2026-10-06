def solve(raw):
 z=raw.splitlines();root=z[0].rstrip("/");out=[]
 for l in z[2:]:
  p,c=l.split("\t",1)
  if p.startswith(root):
   for t in c.split():
    a=t.split(".")
    if len(a)==4 and all(x.isdigit() and int(x)<=255 and (x=="0" or not x.startswith("0")) for x in a):out.append(t)
 return "\n".join(sorted(out))
