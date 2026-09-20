def solve(raw):
    d=raw.split();n=int(d[0]);row=column=0
    for command in d[2:]:
        dr,dc={'UP':(-1,0),'DOWN':(1,0),'LEFT':(0,-1),'RIGHT':(0,1)}[command]
        nr,nc=row+dr,column+dc
        if 0<=nr<n and 0<=nc<n:row,column=nr,nc
    return str(column*n+row)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
