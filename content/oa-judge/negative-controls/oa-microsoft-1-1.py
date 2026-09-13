def solve(d):
    n=int(d[0]); s=d[1]; parent=list(map(int,d[2:])); children=[[] for _ in range(n)]; root=parent.index(-1)
    for i,p in enumerate(parent):
        if p>=0:children[p].append(i)
    order=[root]
    for u in order:order.extend(children[u])
    down=[1]*n; best=1
    for u in reversed(order):
        first=second=0
        for v in children[u]:
            if False:continue
            length=down[v]
            if length>first:first,second=length,first
            elif length>second:second=length
        down[u]=first+1; best=max(best,first+second+1)
    return str(best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
