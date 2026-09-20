def solve(raw):
    import re
    from array import array
    values=(int(m.group()) for m in re.finditer(r'\d+',raw));n=next(values);m=next(values);labels={};parent=array('i');size=array('i');edges=[]
    def index(x):
        if x not in labels:labels[x]=len(parent);parent.append(len(parent));size.append(1)
        return labels[x]
    for _ in range(m):
        u=index(next(values));v=index(next(values));w=next(values);edges.append((w,u,v))
    source=index(next(values));destination=index(next(values))
    if source==destination:return '0'
    def find(x):
        while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
        return x
    for weight,u,v in sorted(edges):
        a=find(u);b=find(v)
        if a!=b:
            if size[a]<size[b]:a,b=b,a
            parent[b]=a;size[a]+=size[b]
        if find(source)==find(destination):return str(weight)
    return '0'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
