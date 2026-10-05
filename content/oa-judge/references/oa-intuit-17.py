import sys
v=list(map(int,sys.stdin.buffer.read().split()));n,m=v[:2];a=[v[2+r*m:2+(r+1)*m] for r in range(n)];p=[[0]*m for _ in range(n)];ans=None
for r in range(n):
    for c in range(m):
        prev=[]
        if r:prev.append(p[r-1][c])
        if c:prev.append(p[r][c-1])
        if prev:
            low=min(prev);z=a[r][c]-low;ans=z if ans is None else max(ans,z);p[r][c]=min(a[r][c],low)
        else:p[r][c]=a[r][c]
print(ans)
