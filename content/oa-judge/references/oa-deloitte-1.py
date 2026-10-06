def solve(raw):
    v=raw.split(); n=int(v[0]); m=int(v[1]); g=v[2:2+n]; seen=set(); ans=0
    for i in range(n):
        for j in range(m):
            if (i,j) in seen: continue
            cells={(i,j),(i,m-1-j),(n-1-i,j),(n-1-i,m-1-j)}; seen |= cells
            blacks=sum(g[r][c]=='B' for r,c in cells); ans+=min(blacks,len(cells)-blacks)
    return str(ans)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
