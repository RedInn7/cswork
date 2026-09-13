def solve(d):
    n=int(d[0]);graph=[[] for _ in range(n)]
    for i in range(1,len(d),2):
        a,b=int(d[i]),int(d[i+1]);graph[a].append((b,1));graph[b].append((a,0))
    stack=[(0,-1)];answer=0
    while stack:
        v,parent=stack.pop()
        for w,cost in graph[v]:
            if w!=parent and v==0:answer+=cost;stack.append((w,v))
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
