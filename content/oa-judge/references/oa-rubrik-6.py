import sys
def solve(raw):
 x,y=raw.split()
 best=0
 for start in range(len(y)):
  i=matched=0
  while i<len(x) and start+matched<len(y):
   if x[i]==y[start+matched]: matched+=1
   i+=1
  best=max(best,matched)
 return str(best)
if __name__ == '__main__': print(solve(sys.stdin.read()))
