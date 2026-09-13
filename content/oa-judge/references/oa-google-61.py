def solve(data):
    h,w=map(int,data[:2]);g=data[2:];seen=set();shapes=set()
    for r in range(h):
        for c in range(w):
            if g[r][c]!='1' or (r,c) in seen:continue
            seen.add((r,c));stack=[(r,c)];points=[]
            while stack:
                x,y=stack.pop();points.append((x-r,y-c))
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    a,b=x+dx,y+dy
                    if 0<=a<h and 0<=b<w and g[a][b]=='1' and (a,b) not in seen:seen.add((a,b));stack.append((a,b))
            shapes.add(tuple(sorted(points)))
    return str(len(shapes))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
