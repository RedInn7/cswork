def solve(d):
    n=int(d[0]);parents=list(map(int,d[1:n+1]));s=d[n+1];children=[[] for _ in range(n)]
    for i in range(1,n):children[parents[i]].append(i)
    order=[0]
    for u in order:order.extend(children[u])
    down=[1]*n;best=1
    for u in reversed(order):
        first=second=0
        for v in children[u]:
            if s[u]==s[v]:continue
            length=down[v]
            if length>first:first,second=length,first
            elif length>second:second=length
        down[u]=first+1;best=max(best,first+1)
    return str(best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
