def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];adj=[set() for _ in range(n)]
    for a,b in zip(d[2::2],d[3::2]):adj[a].add(b);adj[b].add(a)
    out=[]
    for u in range(n):
        counts={}
        for v in adj[u]:
            for w in adj[v]:
                if w!=u and w not in adj[u]:counts[w]=counts.get(w,0)+1
        if counts:best=min(counts,key=lambda v:(-counts[v],v))
        else:
            best=0
            while best<n and (best==u or best in adj[u]):best+=1
            if best==n:best=-1
        out.append(best)
    return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
