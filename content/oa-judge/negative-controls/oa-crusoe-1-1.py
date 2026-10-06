def solve(raw):
 z=list(map(int,raw.split()));p=0;D=z[p];p+=1;u=z[p];p+=1;d=[0]*(D+2)
 for _ in range(u):
  l,r,v=z[p:p+3];p+=3
  if v:d[l]+=1;d[r+1]-=1
 o=z[p];p+=1;ov=[None]*(D+1)
 for _ in range(o):
  l,r,v=z[p:p+3];p+=3
  for i in range(l,r+1):ov[i]=v
 cur=0;s=[]
 for i in range(1,D+1):cur+=d[i];s.append(str(int(cur>0 or ov[i]==1)))
 return ''.join(s)
