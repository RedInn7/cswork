def solve(d):
    n,m=map(int,d[:2])
    if n==1:return '0'
    ids={d[i+2]:i for i in range(n)};parent=list(range(n));size=[1]*n;components=n
    def find(v):
        while parent[v]!=v:parent[v]=parent[parent[v]];v=parent[v]
        return v
    logs=[(int(d[i]),ids[d[i+1]],ids[d[i+2]]) for i in range(n+2,len(d),3)];logs.reverse()
    for time,u,v in logs:
        a,b=find(u),find(v)
        if a==b:continue
        if size[a]<size[b]:a,b=b,a
        parent[b]=a;size[a]+=size[b];components-=1
        if components==1:return str(time)
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
