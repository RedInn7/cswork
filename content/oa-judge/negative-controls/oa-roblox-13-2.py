import sys
def solve(raw):
 t=list(map(int,raw.split())); n,length=t[:2]; p=2; busy=[]
 for _ in range(n):
  m=t[p]; p+=1
  for _ in range(m): busy.append((t[p],t[p+1])); p+=2
 merged=[]
 for a,b in busy:
  if merged and a<=merged[-1][1]: merged[-1]=(merged[-1][0],max(merged[-1][1],b))
  else: merged.append((a,b))
 current=0
 for a,b in merged:
  if a-current>=length: return str(current)
  current=max(current,b)
 return str(current) if current+length<=1440 else '-1'
if __name__=='__main__': print(solve(sys.stdin.read()))
