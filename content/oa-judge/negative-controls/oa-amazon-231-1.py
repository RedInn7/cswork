def solve(d):
    a=list(map(int,d[1:]));return str(abs(a[0])+sum(abs(x-y) for x,y in zip(a,a[1:])))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
