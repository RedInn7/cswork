import sys
def solve(raw):
 x,y=raw.split();m=0;i=0
 for c in y:
  if i<len(x) and x[i]==c: i+=1;m+=1
 return str(m)
if __name__=='__main__': print(solve(sys.stdin.read()))
