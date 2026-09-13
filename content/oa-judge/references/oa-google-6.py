def solve(data):
    n=int(data[0]); values=list(map(int,data[1:n+1]))
    if n==1:return '0'
    edges=list(map(int,data[n+1:])); graph=[[] for _ in range(n)]
    for i in range(0,len(edges),2):
        a,b=edges[i]-1,edges[i+1]-1; graph[a].append(b); graph[b].append(a)
    low=[10**18,10**18]; high=[0,0]; stack=[(0,-1,0)]
    while stack:
        u,parent,color=stack.pop(); low[color]=min(low[color],values[u]); high[color]=max(high[color],values[u])
        for v in graph[u]:
            if v!=parent:stack.append((v,u,1-color))
    return str(sum(high[i]-low[i] for i in range(2)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
