def solve(d):
    a=list(map(int,d[1:]));l=a.index(min(a));r=a.index(max(a));return str(sum(x>y for x,y in zip(a,a[1:])))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
