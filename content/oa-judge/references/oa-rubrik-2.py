import sys
def solve(raw):
    t=list(map(int,raw.split())); n,e,q=t[:3]; edges=t[3:3+2*e]; queries=t[3+2*e:3+2*e+q]
    parent=list(range(n+1)); size=[1]*(n+1)
    def find(x):
        while parent[x]!=x:
            parent[x]=parent[parent[x]]; x=parent[x]
        return x
    for i in range(0,len(edges),2):
        a=find(edges[i]); b=find(edges[i+1])
        if a!=b:
            if size[a]<size[b]: a,b=b,a
            parent[b]=a; size[a]+=size[b]
    return " ".join(str(size[find(x)]) for x in queries)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
