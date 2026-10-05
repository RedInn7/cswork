import sys
def solve(raw):
 it=iter(map(int,raw.split())); n,m,q=next(it),next(it),next(it); a=[next(it) for _ in range(n)]; b=[next(it) for _ in range(m)]
 ca={}; cb={}
 for x in a: ca[x]=ca.get(x,0)+1
 for x in b: cb[x]=cb.get(x,0)+1
 out=[]
 for _ in range(q):
  typ=next(it)
  if typ==0:
   i,x=next(it),next(it); old=a[i]; ca[old]-=1
   if ca[old]==0: del ca[old]
   a[i]+=x; ca[a[i]]=ca.get(a[i],0)+1
  else:
   x=next(it)
   if len(ca)<=len(cb): total=sum(c*cb.get(x-v,0) for v,c in ca.items())
   else: total=sum(c*ca.get(x-v,0) for v,c in cb.items())
   out.append(str(total))
 return ' '.join(out)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
