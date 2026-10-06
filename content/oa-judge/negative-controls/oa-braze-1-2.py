def solve(raw):
 z=raw.splitlines();n,d=map(int,z[0].split());p=[]
 for line in z[1:1+n]:
  a=line.split();p.append((int(a[0]),a[2:2+int(a[1])]))
 D={}
 for line in z[1+n:1+n+d]:
  t,k,v=line.split();D[t]=(int(k),int(v))
 s=0
 for price,tags in p:
  c=[price]
  for t in tags:
   if t in D:
    k,v=D[t];c.append(v if k==0 else round(price*(100-v)/100) if k==1 else price-v)
  s+=min(c)
 return str(s)
