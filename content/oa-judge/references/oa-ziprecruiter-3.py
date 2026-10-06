def solve(raw):
 p=raw.split(); n=int(p[0]); d={}
 for i in range(n):
  name=p[1+2*i]; grade=int(p[2+2*i]); s,c=d.get(name,(0,0)); d[name]=(s+grade,c+1)
 best=None
 for name,(s,c) in d.items():
  if best is None or s*best[2]>best[1]*c: best=(name,s,c)
 return best[0]

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
