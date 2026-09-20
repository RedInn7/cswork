from collections import deque
def solve(d):
    n,m=map(int,d[:2]);infected=list(map(int,d[2:2+n]));adj=[[] for _ in range(n)]
    for i in range(m):
        a,b=map(int,d[2+n+2*i:4+n+2*i]);a-=1;b-=1;adj[a].append(b);adj[b].append(a)
    best=n+1;answer=0
    for removed in ([i for i,v in enumerate(infected) if v] or [0]):
        seen=[False]*n;seen[removed]=True;queue=deque()
        for i,v in enumerate(infected):
            if v and i!=removed:seen[i]=True;queue.append(i)
        count=0
        while queue:
            u=queue.popleft();count+=1
            for v in adj[u]:
                if not seen[v]:seen[v]=True;queue.append(v)
        if count<best:best=count;answer=removed
    return str(answer+1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
