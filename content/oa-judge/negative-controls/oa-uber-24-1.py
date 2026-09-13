def solve(d):
    a=d[1:];n=len(a);resolved=[-1]*n
    for i in range(n):
        path=[];v=i
        while resolved[v]<0:
            path.append(v)
            if a[v][0]!='!':resolved[v]=int(a[v][-1])-1;break
            v=int(a[v][1:])-1
        for w in path:resolved[w]=resolved[v]
    counts=[0]*3
    for i,value in enumerate(resolved):counts[value]+=int(a[i][0]!='!')
    return ' '.join(map(str,counts))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
