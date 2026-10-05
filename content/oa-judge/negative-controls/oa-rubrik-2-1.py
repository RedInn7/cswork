import sys
def solve(raw):
    t=list(map(int,raw.split())); n,e,q=t[:3]; p=3; degree=[0]*(n+1)
    for _ in range(e):
        u,v=t[p:p+2]; p+=2; degree[u]+=1; degree[v]+=1
    return " ".join(str(degree[x]+1) for x in t[p:p+q])
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
