import re
def solve(raw):
 z=raw.splitlines();n,now,w=map(int,z[0].split());c={}
 for line in z[1:1+n]:
  t,tw=line.split("\t",1);t=int(t)
  if now-w<=t<now:
   for h in re.findall(r"#[A-Za-z0-9_]+",tw):c[h]=c.get(h,0)+1
 return "\n".join(sorted(c,key=lambda x:(-c[x],x))[:3])
