def solve(raw):
    v=list(map(int,raw.split()));n=v[0];edges=v[1:1+n];done=[False]*n;best=-1
    for start in range(n):
        if done[start]:continue
        path=[];index={};node=start
        while node!=-1 and not done[node] and node not in index:
            index[node]=len(path);path.append(node);node=edges[node]
        if node!=-1 and node in index:best=max(best,sum(path[index[node]:]))
        for u in path:done[u]=True
    return str(best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
