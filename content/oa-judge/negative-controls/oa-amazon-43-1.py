def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:])); middle=k//2
    return f'{a[n-k+middle]} {a[middle]}'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
