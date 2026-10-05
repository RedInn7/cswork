def solve(raw):
    from array import array
    v=list(map(int,raw.split())); n=v[0]; k=v[1]; a=v[2:2+n]; adj=[[] for _ in range(n)]; p=2+n
    for _ in range(n-1):
        u,w=v[p:p+2]; p+=2; adj[u].append(w); adj[w].append(u)
    # Each DFS frame accumulates the children's values for every inherited halving count.
    stack=[[0,-1,0,array('q',[0])*31]]
    while stack:
        frame=stack[-1]; u,parent,index,child_sum=frame
        if index<len(adj[u]):
            w=adj[u][index]; frame[2]+=1
            if w!=parent: stack.append([w,u,0,array('q',[0])*31])
            continue
        dp=array('q',[0])*31
        for shift in range(30,-1,-1):
            dp[shift]=max((a[u]>>shift)-k+child_sum[min(shift+1,30)], (a[u]>>(shift+1))+child_sum[min(shift+1,30)])
        stack.pop()
        if stack:
            parent_sum=stack[-1][3]
            for shift in range(31): parent_sum[shift]+=dp[shift]
        else:
            return str(dp[0])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
