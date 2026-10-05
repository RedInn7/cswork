import sys
def solve(raw):
 t=raw.split(); it=iter(t); n=int(next(it)); q=int(next(it)); bit=[0]*(n+1); built=bytearray(n); out=[]
 def add(i):
  i+=1
  while i<=n: bit[i]+=1; i+=i&-i
 def prefix(i):
  total=0
  while i: total+=bit[i]; i-=i&-i
  return total
 for _ in range(q):
  op=next(it)
  if op=='build':
   i=int(next(it))
   if not built[i]: built[i]=1; add((i+1)%n)
  else:
   l=int(next(it)); r=int(next(it)); out.append('1' if prefix(r+1)-prefix(l)>0 else '0')
 return ' '.join(out)
if __name__ == '__main__':
 print(solve(sys.stdin.read()))
