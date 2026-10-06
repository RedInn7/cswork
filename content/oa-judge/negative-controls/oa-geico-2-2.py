from collections import OrderedDict
import sys
def solve(raw):
 lines=raw.strip().splitlines(); c=int(lines[0].split("=")[1]); d=OrderedDict(); out=[]
 for s in lines[1:]:
  if s.startswith("put("):
   k,v=map(int,s[4:-1].split(",")); existed=k in d; d[k]=v
   if not existed:d.move_to_end(k)
   if len(d)>c:d.popitem(last=False)
  else:
   k=int(s[4:-1])
   if k not in d:out.append("-1")
   else:d.move_to_end(k); out.append(str(d[k]))
 return "\n".join(out)
print(solve(sys.stdin.read()))
