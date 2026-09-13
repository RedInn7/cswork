def solve(d):
    values=list(map(int,d[1:])); points=list(zip(values[::2],values[1::2])); rows={}; cols={}
    for x,y in points:
        lo,hi=rows.get(y,(x,x)); rows[y]=(min(lo,x),max(hi,x))
        lo,hi=cols.get(x,(y,y)); cols[x]=(min(lo,y),max(hi,y))
    return str(sum(rows[y][0]<x<rows[y][1] for x,y in points))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
