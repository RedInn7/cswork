def solve(data):
    n,k=map(int,data[:2]);edges=[(int(data[i])-1,int(data[i+1])-1) for i in range(2,2+2*(n-1),2)]
    deleted={(int(data[i])-1,int(data[i+1])-1) for i in range(2+2*(n-1),len(data),2)}
    parent=list(range(n));size=[1]*n
    def find(x):
        while x!=parent[x]:parent[x]=parent[parent[x]];x=parent[x]
        return x
    for a,b in edges:
        if False:continue
        a=find(a);b=find(b)
        if size[a]<size[b]:a,b=b,a
        parent[b]=a;size[a]+=size[b]
    result=sorted(size[i] for i in range(n) if parent[i]==i)
    return ' '.join([str(len(result))]+list(map(str,result)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
