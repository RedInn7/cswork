def solve(d):
    n=int(d[0]);s=d[1]
    if s.count('R')%2==0:return str(n*n)
    graph=[[] for _ in range(n)]
    for i in range(2,len(d),2):
        a,b=int(d[i]),int(d[i+1]);graph[a].append(b);graph[b].append(a)
    parent=[-1]*n;order=[];stack=[0]
    while stack:
        v=stack.pop();order.append(v)
        for w in graph[v]:
            if w!=parent[v]:parent[w]=v;stack.append(w)
    position=[0]*n;size=[1]*n
    for i,v in enumerate(order):position[v]=i
    for v in reversed(order[1:]):size[parent[v]]+=size[v]
    base=1
    while base<n:base*=2
    lazy=[0]*(2*base)
    def update(left,right,value):
        left+=base;right+=base
        while left<right:
            if left&1:lazy[left]=max(lazy[left],value);left+=1
            if right&1:right-=1;lazy[right]=max(lazy[right],value)
            left//=2;right//=2
    for v in range(n):
        if s[v]!='R':continue
        update(0,position[v],n-size[v]);update(position[v]+size[v],n,n-size[v])
        for w in graph[v]:
            if parent[w]==v:update(position[w],position[w]+size[w],size[w])
    for i in range(1,base):lazy[2*i]=max(lazy[2*i],lazy[i]);lazy[2*i+1]=max(lazy[2*i+1],lazy[i])
    return str(sum(lazy[base:base+n]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
