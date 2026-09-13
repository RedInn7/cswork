from collections import deque
def solve(d):
    n=int(d[0]);flags=list(map(int,d[1:n+1]));graph=[[] for _ in range(n)]
    for i in range(n+1,len(d),2):
        a,b=int(d[i]),int(d[i+1]);graph[a].append(b);graph[b].append(a)
    degree=list(map(len,graph));alive=[True]*n;remaining=n-1;queue=deque(i for i in range(n) if degree[i]<=1 and flags[i]==0)
    while queue:
        v=queue.popleft()
        if not alive[v]:continue
        alive[v]=False
        for w in graph[v]:
            if alive[w]:remaining-=1;degree[w]-=1
            else:continue
            if degree[w]<=1 and flags[w]==0:queue.append(w)
    queue=deque(i for i in range(n) if alive[i] and degree[i]<=1)
    for _ in range(2):
        for _ in range(len(queue)):
            v=queue.popleft();alive[v]=False
            for w in graph[v]:
                if alive[w]:remaining-=1;degree[w]-=1
                else:continue
                if degree[w]==1:queue.append(w)
    return str(max(0,remaining))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
