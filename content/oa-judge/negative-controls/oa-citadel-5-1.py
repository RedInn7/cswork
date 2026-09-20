def solve(raw):
    d=list(map(int,raw.split()));n=d[0];parent=d[1:n+1];values=d[n+1:];children=[[] for _ in range(n)]
    for i in range(1,n):children[parent[i]].append(i)
    order=[0]
    for u in order:order.extend(children[u])
    best=values[:]
    for u in reversed(order):best[u]=values[u]+sum(max(0,best[v]) for v in children[u])
    return str(max(best))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
