def solve(d):
    a=sorted(map(int,d[1:]));n=len(a)
    return str(sum(a[n-2-2*i] for i in range(n//3)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
