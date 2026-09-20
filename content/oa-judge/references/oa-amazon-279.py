def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));remaining=n-k+1;middle=remaining//2;twice=2*sum(a[remaining:])
    twice+=2*a[middle] if remaining%2 else a[middle-1]+a[middle]
    return str((twice+1)//2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
