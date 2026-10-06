def solve(raw):
 z=list(map(int,raw.split()));n=z[0];a=z[1:1+n];b=z[1+n:1+2*n]
 return str(-1 if sum(a)>sum(b) else 0)
