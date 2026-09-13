def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));remaining=n-k+1;j=remaining//2
    middle=2*a[j] if remaining%2 else a[j-1]+a[j]
    return str(sum(a[remaining:])+middle//2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
