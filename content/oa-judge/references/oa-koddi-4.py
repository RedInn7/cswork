import sys
def solve(raw):
    a=list(map(int,raw.split()));r,c,k=a[:3]; blacks={tuple(a[3+2*i:5+2*i]) for i in range(k)}; freq={}
    for x,y in blacks:
      for i in (x-1,x):
        for j in (y-1,y):
          if 0<=i<r-1 and 0<=j<c-1: freq[(i,j)]=freq.get((i,j),0)+1
    ans=[0]*5
    for z in freq.values():ans[z]+=1
    ans[0]=(r-1)*(c-1)-len(freq)
    return ' '.join(map(str,ans))

print(solve(sys.stdin.read()))
