def solve(raw):
 z=raw.splitlines();n,d=map(int,z[0].split());p=[]
 for line in z[1:1+n]:
  a=line.split();p.append((int(a[0]),a[2:2+int(a[1])]))
 disc={}
 for line in z[1+n:1+n+d]:
  k,t,v=line.split();disc[k]=(int(t),int(v))
 total=0
 for price,tags in p:
  best=price
  for tag in tags:
   if tag not in disc:continue
   t,v=disc[tag];x=v if t==0 else price*(100-v)//100 if t==1 else price-v;best=min(best,x)
  total+=best
 return str(total)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
