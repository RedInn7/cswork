def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));weights=sorted(a[i]+a[i+1] for i in range(n-1));base=a[0]+a[-1]
    smallest=base+sum(weights[:k-1]);largest=base+sum(weights[len(weights)-(k-1):])
    return f'{smallest} {largest}'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
