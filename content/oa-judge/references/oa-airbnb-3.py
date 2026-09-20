def solve(raw):
    from collections import deque
    d=list(map(int,raw.split()));n,m,k=d[:3];a=d[3:]
    if a[0] or a[-1]:return '-1'
    dist=[-1]*(n*m);dist[0]=0;q=deque([0])
    while q:
        p=q.popleft();i,j=divmod(p,m)
        for di,dj in ((1,0),(-1,0),(0,1),(0,-1)):
            for step in range(1,k+1):
                u=i+di*step;v=j+dj*step
                if not (0<=u<n and 0<=v<m):break
                z=u*m+v
                if a[z]:break
                if dist[z]<0:dist[z]=dist[p]+1;q.append(z)
    return str(dist[-1])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
