def solve(d):
    n,q=map(int,d[:2]);labels=d[2];graph=[[] for _ in range(n)];cursor=3
    for _ in range(n-1):
        a,b=map(int,d[cursor:cursor+2]);cursor+=2;graph[a].append(b);graph[b].append(a)
    parent=[0]*n;depth=[0]*n;mask=[0]*n;mask[0]=1<<(ord(labels[0])-97);stack=[0]
    while stack:
        v=stack.pop()
        for w in graph[v]:
            if w==parent[v]:continue
            parent[w]=v;depth[w]=depth[v]+1;mask[w]=mask[v]^(1<<(ord(labels[w])-97));stack.append(w)
    up=[parent]
    for _ in range(1,n.bit_length()):up.append([up[-1][up[-1][i]] for i in range(n)])
    def lca(a,b):
        if depth[a]<depth[b]:a,b=b,a
        delta=depth[a]-depth[b]
        for j in range(len(up)):
            if delta>>j&1:a=up[j][a]
        if a==b:return a
        for j in range(len(up)-1,-1,-1):
            if up[j][a]!=up[j][b]:a,b=up[j][a],up[j][b]
        return parent[a]
    answer=[]
    for _ in range(q):
        a,b=map(int,d[cursor:cursor+2]);cursor+=2;v=lca(a,b);parity=mask[a]^mask[b];answer.append(str(int(parity.bit_count()<=1)))
    return '\n'.join(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
