import json,sys
def solve(raw):
 p=raw.split(); work,limit=map(int,p[:2]); pattern=p[2]
 if not 1<=work<=56 or not 1<=limit<=8 or len(pattern)!=7: raise ValueError("invalid input")
 fixed=sum(int(c) for c in pattern if c!="?"); slots=[i for i,c in enumerate(pattern) if c=="?"]; chars=list(pattern); out=[]
 def visit(i,left):
  if left<0 or left>(len(slots)-i)*limit:return
  if i==len(slots):
   if left==0:out.append("".join(chars))
   return
  pos=slots[i]
  for x in range(limit+1):chars[pos]=str(x);visit(i+1,left-x)
  chars[pos]="?"
 visit(0,work-fixed);return json.dumps(out,separators=(",",":"))
if __name__=="__main__":print(solve(sys.stdin.read()))
