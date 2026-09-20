def solve(d):
    a=sorted(map(int,d[1:]));n=len(a)
    return str(len({a[i]+a[n-1-i] for i in range(n//2)}))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
