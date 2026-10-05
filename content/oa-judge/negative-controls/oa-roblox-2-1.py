import sys
def solve(raw):
 t=list(map(int,raw.split())); n,k=t[0],t[1]; a=t[2:2+n]
 freq={}; left=pairs=answer=0
 for right,x in enumerate(a):
  old=freq.get(x,0); freq[x]=old+1
  if old%2: pairs+=1
  while pairs>k:
   y=a[left]; old=freq[y]
   if old%2==0: pairs-=1
   freq[y]=old-1; left+=1
  answer+=left
 return str(answer)
if __name__=='__main__': print(solve(sys.stdin.read()))
