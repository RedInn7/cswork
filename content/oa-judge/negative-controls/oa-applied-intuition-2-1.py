def solve(raw):
 v=raw.splitlines();q=int(v[0]);base={};layers=[];out=[]
 def get(k):
  for d in reversed(layers):
   if k in d:return d[k]
  return base.get(k)
 for c in v[1:q+1]:
  p=c.split();op=p[0]
  if op=='SET':(layers[-1] if layers else base)[p[1]]=p[2]
  elif op=='DELETE':(layers[-1] if layers else base)[p[1]]=None
  elif op=='GET':
   x=get(p[1]);out.append('NULL' if x is None else x)
  elif op=='BEGIN':layers.append({})
  elif op=='ROLLBACK':
   if layers:layers.pop()
   else:out.append('NO TRANSACTION')
  elif op=='COMMIT':
   if not layers:out.append('NO TRANSACTION')
   else:layers.pop()
 return '\n'.join(out)

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
