def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));cuts=sorted(a[i]+a[i+1] for i in range(n-1));base=0
    low=base+sum(cuts[:k-1]);high=base+sum(cuts[len(cuts)-(k-1):])
    return f'{low} {high}'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
