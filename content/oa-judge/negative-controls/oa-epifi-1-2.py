def solve(raw):
 z=list(map(int,raw.split()));n=z[0];a=z[1:1+n];b=[x-1 for x in z[1+n:1+2*n]]
 if sum(a)>sum(b):return "-1"
 for d in range(n):
  x=a[:];y=b[:];ok=True
  for i in range(n):
   while x[i]:
    j=next((j for j in range(n) if abs(i-j)<=1 and y[j]),None)
    if j is None:ok=False;break
    t=min(x[i],y[j]);x[i]-=t;y[j]-=t
   if not ok:break
  if ok:return str(d)
 return "-1"
