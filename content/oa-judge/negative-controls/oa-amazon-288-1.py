def solve(d):
    n=int(d[0]);a=list(map(int,d[1:]));position=[0]*(n+1)
    for i,v in enumerate(a):position[v]=i
    return str(1+sum(a[i+1]<a[i] for i in range(n-1)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
