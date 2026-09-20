def solve(raw):
    s=raw.strip();length=[-1,0];link=[0,0];edge=[{},{}];last=1
    for i,c in enumerate(s):
        p=last
        while i-1-length[p]<0 or s[i-1-length[p]]!=c:p=link[p]
        if c not in edge[p]:
            node=len(length);length.append(length[p]+2);link.append(1);edge.append({});edge[p][c]=node
            if length[node]>1:
                q=link[p]
                while i-1-length[q]<0 or s[i-1-length[q]]!=c:q=link[q]
                link[node]=edge[q][c]
        last=edge[p][c]
    return str(len(length)-2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
