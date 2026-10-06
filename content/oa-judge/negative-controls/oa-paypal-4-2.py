import sys
def nondecreasing_cost(a):
 vals=sorted(set(a)); dp=[abs(a[0]-v) for v in vals]
 for x in a[1:]:
  nd=[]; best=10**30
  for j,v in enumerate(vals):
   best=min(dp[:j],default=10**30); nd.append(best+abs(x-v))
  dp=nd
 return min(dp)
def solve(raw):
 t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]
 return str(min(nondecreasing_cost(a),nondecreasing_cost(a[::-1])))
if __name__=='__main__': print(solve(sys.stdin.read()))
