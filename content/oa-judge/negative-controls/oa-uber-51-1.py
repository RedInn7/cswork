def solve(d):
    n=int(d[0]);graph=[[] for _ in range(n)]
    for i in range(1,len(d),2):
        a,b=map(int,d[i:i+2]);graph[a].append((b,0));graph[b].append((a,1))
    parent=[-1]*n;order=[0];cost=[0]*n;initial=0
    for v in order:
        for w,reverse in graph[v]:
            if w==parent[v]:continue
            parent[w]=v;cost[w]=reverse;initial+=reverse;order.append(w)
    answer=[initial]*n
    for v in order[1:]:answer[v]=answer[parent[v]]+1-2*cost[v]
    return str(answer[0])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
