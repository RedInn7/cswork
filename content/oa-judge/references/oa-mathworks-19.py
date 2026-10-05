def solve(s):
 d=list(map(int,s.split()));a=d[1:];z=sum(x for x in a if x>0)
 if z%2==0:return str(z)
 pos=[x for x in a if x>0 and x%2];neg=[x for x in a if x<0 and x%2]
 return str(max(z-min(pos) if pos else -10**100,z+max(neg) if neg else -10**100,0))
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
