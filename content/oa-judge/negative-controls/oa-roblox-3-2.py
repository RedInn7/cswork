import sys
def solve(raw):
 t=list(map(int,raw.split())); rows,cols,r=t[:3]; a=[t[3+i*cols:3+(i+1)*cols] for i in range(rows)]
 pref=[[0]*(cols+1) for _ in range(rows)]
 for i in range(rows):
  for j in range(cols): pref[i][j+1]=pref[i][j]+a[i][j]
 best=None
 for cr in range(r-1,rows-r+1):
  for cc in range(r-1,cols-r+1):
   total=0
   for dr in range(-(r-1),r):
    rr=cr+dr
    if 0<=rr<rows:
     span=r-2-abs(dr); lo=max(0,cc-span); hi=min(cols-1,cc+span)
     total+=pref[rr][hi+1]-pref[rr][lo]
   if best is None or total>best: best=total
 return str(best if best is not None else 0)
if __name__=='__main__': print(solve(sys.stdin.read()))
