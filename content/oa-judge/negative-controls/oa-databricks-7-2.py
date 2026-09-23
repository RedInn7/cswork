def solve(data):
    v=list(map(int,data.split())); n=v[0]; mid=n//2
    inside=[0]*3; outside=[0]*3
    for r in range(n):
        for c in range(n):
            is_y=(r<=mid and c in (r,n-1-r)) or (r>mid and c==mid)
            group=inside if is_y else outside; group[v[1+r*n+c]]+=1
    return str(min((n*n-inside[y]-outside[b]) for y in range(3) for b in range(3) if True))

if __name__=='__main__':
 import sys
 print(solve(sys.stdin.read()))
