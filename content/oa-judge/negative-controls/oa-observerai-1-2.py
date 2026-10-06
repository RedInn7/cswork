def solve(raw):
 z=raw.splitlines();p=0;n=int(z[p]);p+=1;a=list(map(int,z[p].split()));p+=1;f=int(z[p]);p+=1;b=[]
 for i in range(f):
  m=int(z[p]);p+=1;g=list(map(int,z[p].split()))[:m];p+=1
  c=[]
  for x in a:
   q=[v for v in g if v>=x]
   if not q:break
   c.append(min(q)-x)
  if len(c)==len(a):b.append((sum(c),-i))
 return str(-min(b)[1] if b else -1)
