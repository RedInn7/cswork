def solve(d):
    import json
    names,pairs=json.loads(''.join(d));position={v:i for i,v in enumerate(names)};parent=list(range(len(names)));size=[1]*len(names)
    def find(i):
        while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
        return i
    for a,b in pairs:
        x=find(position[a]);y=find(position[b])
        if x==y:continue
        if size[x]<size[y]:x,y=y,x
        parent[y]=x;size[x]+=size[y]
    answer=sorted(size[i] for i in range(len(names)) if parent[i]==i)
    return ' '.join(map(str,answer)) if answer else '0'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
