def solve(d):
    n,m=map(int,d[:2]);degree=[0]*n;edges=list(map(int,d[2:]))
    for v in edges:degree[v-1]+=1
    degree.sort()
    return str(sum(i*v for i,v in enumerate(degree)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
