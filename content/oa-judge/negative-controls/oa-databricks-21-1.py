def solve(data):
    v=list(map(int,data.split())); n,m=v[:2]; a=v[2:2+n]; b=v[2+n:2+n+m]; root={}
    for x in b:
        node=root
        for c in str(x)[:-1]: node=node.setdefault(c,{})
    best=0
    for x in a:
        node=root; depth=0
        for c in str(x):
            if c not in node: break
            node=node[c]; depth+=1
        best=max(best,depth)
    return str(best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
