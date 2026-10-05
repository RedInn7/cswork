def grid_decode(raw):
 it=iter(map(int,raw.split())); r=next(it); a=[]
 for _ in range(r):
  c=next(it); a.append([next(it) for _ in range(c)])
 return a
def grid_decode(raw):
 it=iter(map(int,raw.split())); r=next(it); a=[]
 for _ in range(r):
  c=next(it); a.append([next(it) for _ in range(c)])
 return a
def grid_decode(raw):
 it=iter(map(int,raw.split())); r=next(it); a=[]
 for _ in range(r):
  c=next(it); a.append([next(it) for _ in range(c)])
 return a
def solve(raw):
 rows=grid_decode(raw); cells={(r,c):v for r,row in enumerate(rows) for c,v in enumerate(row)}
 dp={}; total=0
 for (r,c),v in sorted(cells.items(),key=lambda x:x[1]):
  ways=1
  for nr,nc in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):
   if (nr,nc) in cells and cells[(nr,nc)]<v: ways+=dp[(nr,nc)]
  dp[(r,c)]=ways; total+=ways
 return str(total)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
