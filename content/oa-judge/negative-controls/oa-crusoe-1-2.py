def solve(raw):
 z=list(map(int,raw.split()));p=0;D=z[p];p+=1;u=z[p];p+=1;p+=3*u;o=z[p];p+=1;v=[0]*(D+1)
 for _ in range(o):
  l,r,b=z[p:p+3];p+=3
  for i in range(l,r+1):v[i]=b
 return ''.join(str(v[i]) for i in range(1,D+1))
