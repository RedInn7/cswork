import sys
def solve(raw):
 x,y=raw.split();best=0
 for start in range(len(y)):
  for end in range(start+1,len(y)+1):
   if y[start:end] in x: best=max(best,end-start)
 return str(best)
if __name__=='__main__': print(solve(sys.stdin.read()))
