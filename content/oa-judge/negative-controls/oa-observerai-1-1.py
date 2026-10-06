def solve(raw):
 z=raw.splitlines();p=0;n=int(z[p]);p+=1;a=list(map(int,z[p].split()));p+=1;f=int(z[p]);p+=1;b=[]
 for i in range(f):
  m=int(z[p]);p+=1;g=list(map(int,z[p].split()))[:m];p+=1
  if all(max(g)>=x for x in a):b.append((sum(max(g)-x for x in a),i))
 return str(min(b)[1] if b else -1)
