def solve(d):
    a=list(map(int,d[1:]));return str(sum(max(0,a[i-1]-a[i]) for i in range(1,len(a))))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
