def solve(d):
    n,m=map(int,d[:2]);edges=list(map(int,d[2:]));adjacent=set()
    for i in range(0,len(edges),2):
        a,b=edges[i:i+2]
        if abs(a-b)==1:adjacent.add(min(a,b))
    return str(int(m>=n-1))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
