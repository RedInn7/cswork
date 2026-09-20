def solve(d):
    n,m=map(int,d[:2])
    def regions(rows):
        seen=set();out=set()
        for start in range(n*m):
            if start in seen or rows[start//m][start%m]!='1':continue
            seen.add(start);stack=[start];part=set()
            while stack:
                u=stack.pop();part.add(u);r,c=divmod(u,m)
                for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
                    nr,nc=r+dr,c+dc;v=nr*m+nc
                    if 0<=nr<n and 0<=nc<m and v not in seen and rows[nr][nc]=='1':
                        seen.add(v);stack.append(v)
            out.add(frozenset(part))
        return out
    a=regions(d[2:2+n]);b=regions(d[2+n:2+2*n])
    sizes={len(y) for y in a}
    return str(sum(len(x) in sizes for x in b))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
