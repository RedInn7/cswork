def solve(d):
    n=int(d[0]);g=[[] for _ in range(n)];edges=list(map(int,d[1:]))
    for i in range(0,len(edges),2):u,v=edges[i]-1,edges[i+1]-1;g[u].append(v);g[v].append(u)
    parent=[-1]*n;order=[0]
    for u in order:
        for v in g[u]:
            if v!=parent[u]:parent[v]=u;order.append(v)
    tables=[None]*n
    for u in reversed(order):
        dp=[0,1]
        for v in g[u]:
            if parent[v]!=u:continue
            child=tables[v];best=max(j*child[j] for j in range(1,len(child)));nxt=[0]*(len(dp)+len(child)-1)
            for k in range(1,len(dp)):
                value=dp[k];nxt[k]=max(nxt[k],value*best)
                for j in range(1,len(child)):nxt[k+j]=max(nxt[k+j],value*child[j])
            dp=nxt;tables[v]=None
        tables[u]=dp
    sizes=[1]*n
    for u in reversed(order[1:]):sizes[parent[u]]+=sizes[u]
    return str(max(sizes[u]*(n-sizes[u]) for u in order[1:]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
