import sys
def solve(raw):
 t=raw.split(); n=int(t[0]); best_id=''; best=-1
 for i in range(n):
  key=t[1+2*i]; value=int(t[2+2*i])
  if value<best: best=value; best_id=key
 return best_id
if __name__=='__main__': print(solve(sys.stdin.read()))
