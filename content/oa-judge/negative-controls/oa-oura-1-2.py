def solve(raw):
 z=raw.splitlines();q=int(z[0]);s=set();n=1;o=[]
 for l in z[1:]:
  p=l.split()
  if p[0]=="allocate":
   while n in s:n+=1
   s.add(n);o.append(str(n));n+=1
  else:s.discard(int(p[2]))
 return "\n".join(o)
