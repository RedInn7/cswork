from collections import OrderedDict
import sys
def solve(raw):
 lines=raw.strip().splitlines(); c=int(lines[0].split("=")[1]); d=OrderedDict(); out=[]
 for s in lines[1:]:
  if s.startswith("put("):
   k,v=map(int,s[4:-1].split(",")); d[k]=v; d.move_to_end(k)
   if len(d)>c:d.popitem(last=False)
  else:
   k=int(s[4:-1]); out.append(str(d.get(k,-1)))
 return "\n".join(out)
print(solve(sys.stdin.read()))
