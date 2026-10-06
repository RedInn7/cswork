import sys
def solve(raw):
 t=list(map(int,raw.split())); r,m=t[:2]; score=[0]*r; pts=(0,10,6,4,3,2,1); p=2
 for _ in range(m):
  race,who,pos=t[p:p+3]; p+=3
  if pos<=6: score[who-1001]+=pts[pos]
 i=min(range(r),key=lambda j:(-score[j],-j))
 return f'{1001+i} {score[i]}'
if __name__=='__main__': print(solve(sys.stdin.read()))
