import sys
def solve(raw):
 a,b=raw.splitlines()[:2];ca={};cb={}
 for c in a:ca[c]=ca.get(c,0)+1
 for c in b:cb[c]=cb.get(c,0)+1
 keys=ca.keys()|cb.keys();u=sum(max(ca.get(c,0),cb.get(c,0)) for c in keys)
 i=sum(min(ca.get(c,0),cb.get(c,0)) for c in keys)
 return f'{i/u:.12f}'
if __name__=='__main__': print(solve(sys.stdin.read()))
