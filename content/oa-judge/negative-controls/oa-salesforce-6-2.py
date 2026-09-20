from collections import deque
def solve(d):
    n=int(d[0]);data=list(map(int,d[1:n+1]));adj=[[] for _ in range(n)];degree=[0]*n;removed=[False]*n
    for i in range(n-1):
        a,b=map(int,d[n+1+2*i:n+3+2*i]);adj[a].append(b);adj[b].append(a);degree[a]+=1;degree[b]+=1
    queue=deque(i for i in range(n) if degree[i]<=1 and data[i]==0)
    while queue:
        u=queue.popleft()
        if removed[u]:continue
        removed[u]=True
        for v in adj[u]:
            if not removed[v]:degree[v]-=1;degree[u]-=1
            if not removed[v] and degree[v]==1 and data[v]==0:queue.append(v)
    queue=deque(i for i in range(n) if not removed[i] and degree[i]==1)
    for _ in range(2):
        for _ in range(len(queue)):
            u=queue.popleft();removed[u]=True
            for v in adj[u]:
                if not removed[v]:degree[v]-=1;degree[u]-=1
                if not removed[v] and degree[v]==1:queue.append(v)
    return str(sum(degree[i] for i in range(n) if not removed[i])//2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
