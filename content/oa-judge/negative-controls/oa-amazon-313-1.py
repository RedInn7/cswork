def solve(d):
    v=list(map(int,d[1:]));points=list(zip(v[::2],v[1::2]));rows={};cols={}
    for x,y in points:
        if y not in rows:rows[y]=[x,x]
        else:rows[y][0]=min(rows[y][0],x);rows[y][1]=max(rows[y][1],x)
        if x not in cols:cols[x]=[y,y]
        else:cols[x][0]=min(cols[x][0],y);cols[x][1]=max(cols[x][1],y)
    return str(sum(rows[y][0]<x<rows[y][1]  for x,y in points))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
