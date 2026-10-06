def solve(raw):
 lines=raw.splitlines(); z=[]; o=[]
 for line in lines[1:]:
  p=line.split(" ")
  if p[0]=="ADD":z.append((int(p[1]),p[2],p[3]," ".join(p[4:])))
  else:
   _,a,b,s,l,k=p;a=int(a);b=int(b);o.append(str(sum(a<=t<b and (s=="*" or s==ss) and (l=="*" or l==ll) and (k=="*" or k in m) for t,ss,ll,m in z)))
 return "\n".join(o)
