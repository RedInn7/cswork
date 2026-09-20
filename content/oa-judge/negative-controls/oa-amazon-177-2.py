def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]))
    return str(min(a[i+k-1]-a[i]+min(abs(a[i]),abs(a[i+k-1])) for i in range(1)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
