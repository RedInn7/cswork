def solve(data):
    n=int(data[0]);v=list(map(int,data[1:]));a=list(zip(v[::3],v[1::3],v[2::3]));reach=[]
    for x,y,r in a:
        bits=0
        for j,(u,v,s) in enumerate(a):
            if (x-u)**2+(y-v)**2<=r*r:bits|=1<<j
        reach.append(bits)
    for k in range(n):
        bit=1<<k;row=reach[k]
        for i in range(n):
            if reach[i]&bit:reach[i]|=row
    return str(max(row.bit_count() for row in reach))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
