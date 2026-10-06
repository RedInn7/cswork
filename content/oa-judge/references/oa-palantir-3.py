import sys
def solve(raw):
 z=raw.split(); n=int(z[0]); out=[]
 for w in z[1:1+n]:
  changes=0; last=None
  for c in w:
   if c==last: changes+=1; last=None
   else: last=c
  out.append(str(changes))
 return " ".join(out)
if __name__=="__main__": print(solve(sys.stdin.read()))
