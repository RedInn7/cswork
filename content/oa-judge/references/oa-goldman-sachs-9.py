import sys
def solve(raw):
 t=list(map(int,raw.split())); rate,duration,n=t[:3]; keys=t[3:3+n]; limit=max(keys); freq=[0]*(limit+1)
 for x in keys: freq[x]+=1
 best=0
 for value in keys:
  degree=0
  for d in range(2,value+1):
   if value%d==0: degree+=freq[d]
  best=max(best,degree)
 strength=best*100000
 return f'{int(rate*duration>=strength)} {strength}'
if __name__=='__main__': print(solve(sys.stdin.read()))
