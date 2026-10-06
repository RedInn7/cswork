def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; p=[tuple(v[1+2*i:3+2*i]) for i in range(n)]
    best=[10**30]*n; best[0]=0; used=[False]*n; total=0
    for _ in range(n):
        u=min((i for i in range(n) if not used[i]),key=lambda i:best[i]); used[u]=True; total+=best[u]
        for j in range(n):
            if not used[j]: best[j]=min(best[j],abs(p[u][0]-p[j][0])+abs(p[u][1]-p[j][1]))
    return str(total)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
