def solve(data):
    n=int(data[0]); g=[[] for _ in range(n)]
    for i in range(1,len(data),2):
        u=int(data[i])-1;v=int(data[i+1])-1;g[u].append(v);g[v].append(u)
    def farthest(root):
        dist=[-1]*n;dist[root]=0;queue=[root]
        for u in queue:
            for v in g[u]:
                if dist[v]<0:dist[v]=dist[u]+1;queue.append(v)
        return queue[-1],dist[queue[-1]]
    u,_=farthest(0);_,diameter=farthest(u)
    return str((diameter+1)//2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
