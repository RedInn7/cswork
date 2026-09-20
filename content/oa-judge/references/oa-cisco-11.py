from collections import deque
def solve(raw):
    d=iter(map(int,raw.split()));n=next(d);coins=[next(d) for _ in range(n)];adj=[[] for _ in range(n)];degree=[0]*n;alive=[True]*n;remaining=n-1
    for a,b in zip(d,d):adj[a].append(b);adj[b].append(a);degree[a]+=1;degree[b]+=1
    q=deque(i for i in range(n) if degree[i]<=1 and not coins[i])
    while q:
        u=q.popleft()
        if not alive[u]:continue
        alive[u]=False
        for v in adj[u]:
            if alive[v]:
                remaining-=1;degree[v]-=1
                if degree[v]<=1 and not coins[v]:q.append(v)
    layer=[i for i in range(n) if alive[i] and degree[i]<=1]
    for _ in range(2):
        following=[]
        for u in layer:
            alive[u]=False
            for v in adj[u]:
                if alive[v]:
                    remaining-=1;degree[v]-=1
                    if degree[v]==1:following.append(v)
        layer=following
    return str(2*max(0,remaining))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
