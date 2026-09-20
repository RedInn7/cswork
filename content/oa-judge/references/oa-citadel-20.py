def solve(raw):
    d=raw.split();m=int(d[0]);target=int(d[1]);tokens=d[2:]
    if not m or tokens[0]=='null':return '0\n'
    values=[int(tokens[0])];parent=[-1];children=[[]];q=0;i=1
    while q<len(values) and i<m:
        for side in range(2):
            if i==m:break
            token=tokens[i];i+=1
            if token!='null':
                v=len(values);values.append(int(token));parent.append(q);children.append([]);children[q].append(v)
        q+=1
    n=len(values);rank=[0]*n;sums=[0]*n;sums[0]=values[0];layer=[0]
    while layer:
        valid=[u for u in layer if not children[u] and sums[u]==target]
        if valid:
            u=min(valid,key=lambda u:rank[u]);path=[]
            while u!=-1:path.append(values[u]);u=parent[u]
            path.reverse();return str(len(path))+'\n'+' '.join(map(str,path))
        following=[]
        for u in layer:
            for v in children[u]:sums[v]=sums[u]+values[v];following.append(v)
        following.sort(key=lambda v:(rank[parent[v]],values[v]));last=None;r=-1
        for v in following:
            key=(rank[parent[v]],values[v])
            if key!=last:r+=1;last=key
            rank[v]=r
        layer=following
    return '0\n'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
