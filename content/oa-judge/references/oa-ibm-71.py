def solve(raw):
    d=list(map(int,raw.split()));n,m,q=d[:3];parent=list(range(n+1));size=[1]*(n+1)
    def find(x):
        while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
        return x
    p=3
    for _ in range(m):
        a,b=find(d[p]),find(d[p+1]);p+=2
        if a!=b:
            if size[a]<size[b]:a,b=b,a
            parent[b]=a;size[a]+=size[b]
    return ' '.join(str(size[find(v)]) for v in d[p:])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
