import sys
def solve(raw):
 lines=raw.splitlines(); n=int(lines[0]); stack=[]; held=set()
 for i,line in enumerate(lines[1:1+n],1):
  op,name=line.split()
  if op=='ACQUIRE':
   if name in held: return str(i)
   held.add(name); stack.append(name)
  else:
   if not stack or stack[-1]!=name: return str(i)
   stack.pop(); held.remove(name)
 return str(0 if not stack else n+1)
if __name__=='__main__': print(solve(sys.stdin.read()))
