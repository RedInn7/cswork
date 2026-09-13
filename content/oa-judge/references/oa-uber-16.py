def solve(d):
    n,m=map(int,d[:2]);letters=d[2];g=[[] for _ in range(n)];offset=3
    for _ in range(n-1):
        a,b=map(int,d[offset:offset+2]);offset+=2;g[a].append(b);g[b].append(a)
    answers=[0]*n;counts={0:1};stack=[(0,-1,0,False)]
    while stack:
        node,parent,mask,exit=stack.pop()
        if exit:
            counts[mask]-=1
            if counts[mask]==0:del counts[mask]
            continue
        mask^=1<<(ord(letters[node])-97);answers[node]=counts.get(mask,0)+sum(counts.get(mask^(1<<bit),0) for bit in range(26));counts[mask]=counts.get(mask,0)+1;stack.append((node,parent,mask,True))
        for child in g[node]:
            if child!=parent:stack.append((child,node,mask,False))
    return ' '.join(str(answers[int(q)]) for q in d[offset:])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
