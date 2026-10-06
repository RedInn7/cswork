def solve(raw):
    v=list(map(int,raw.split()));n=v[0];edges=[(v[1+2*i],v[2+2*i]) for i in range(n-1)];p=1+2*(n-1);initial=v[p:p+n];expected=v[p+n:p+2*n];adj=[[] for _ in range(n)]
    for a,b in edges:adj[a].append(b);adj[b].append(a)
    stack=[(0,-1,0,0)];answer=0
    while stack:
        u,parent,even_flip,odd_flip=stack.pop();parity=0;current=even_flip if parity==0 else odd_flip
        if initial[u]^current!=expected[u]:
            if parity==0:even_flip^=1
            else:odd_flip^=1
            answer+=1
        for child in adj[u]:
            if child!=parent:stack.append((child,u,even_flip,odd_flip))
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
