def solve(raw):
 z=raw.splitlines();limit=int(z[0]);doc=z[1:];heads=[];chunks=[];cur=[]
 for line in doc:
  q=line.lstrip();ishead=q.startswith('#')
  if ishead:
   level=len(q)-len(q.lstrip('#'));heads=heads[:level-1]+[line]
  trial=cur+[line]
  if cur and len(' | '.join(trial))>limit:
   chunks.append(' | '.join(cur));cur=[];cur=heads[:] if ishead else heads+[line] if heads else [line]
  else:cur=trial
 if cur:chunks.append(' | '.join(cur))
 return '\n'.join(chunks)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
