def solve(d):
    n,m,t=map(int,d[:3]);g=[list(row) for row in d[3:]];counts=[[0]*m for _ in range(n)];front=[];days=0
    def adjacent(r,c):
        for x in range(max(0,r-1),min(n,r+2)):
            for y in range(max(0,c-1),min(m,c+2)):
                if (x,y)!=(r,c):yield x,y
    for r in range(n):
        for c in range(m):
            if g[r][c]=='X':
                for x,y in adjacent(r,c):counts[x][y]+=1
    for r in range(n):
        for c in range(m):
            if g[r][c]=='.' and counts[r][c]>t:front.append((r,c));g[r][c]='Q'
    while front:
        days+=1;following=[]
        for r,c in front:
            g[r][c]='X'
            for x,y in adjacent(r,c):
                counts[x][y]+=1
                if g[x][y]=='.' and counts[x][y]>t:g[x][y]='Q';following.append((x,y))
        front=following
    return str(days)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
