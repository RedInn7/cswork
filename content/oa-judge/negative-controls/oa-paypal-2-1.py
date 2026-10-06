import sys,re
from datetime import date
def solve(raw):
 lines=raw.splitlines(); n=int(lines[0]); counts={}
 for line in lines[1:1+n]:
  user,tm,day=line.split()
  if not re.fullmatch(r'user(?:0|[1-9][0-9]{0,9})',user): continue
  if not re.fullmatch(r'[0-9]{2}:[0-9]{2}:[0-9]{2}',tm): continue
  if not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}',day): continue
  h,m,s=map(int,tm.split(':'))
  # invalid time/date accepted
  counts[(user,day)]=counts.get((user,day),0)+1
 rows=sorted((u,d,c) for (u,d),c in counts.items())
 return str(len(rows))+('\n'+'\n'.join(f'{u} {d} {c}' for u,d,c in rows) if rows else '')
if __name__=='__main__': print(solve(sys.stdin.read()))
