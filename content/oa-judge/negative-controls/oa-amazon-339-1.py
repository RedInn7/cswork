def solve(raw):
    import io
    stream=io.StringIO(raw);n,m=map(int,stream.readline().split());parent=list(range(n+m));size=[1]*(n+m);active=set()
    def find(x):
        while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
        return x
    for i in range(n):
        for j,value in enumerate(stream.readline().split()):
            if value=='1':
                active.add(i);a,b=find(i),find(n+j)
                if a!=b:
                    if size[a]<size[b]:a,b=b,a
                    parent[b]=a;size[a]+=size[b]
    return str(len(active))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
