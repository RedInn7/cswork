def solve(d):
    a=sorted(map(int,d[1:]));best=run=1
    for i in range(1,len(a)):
        run=run+1 if a[i]-a[i-1]==1 else 1;best=max(best,run)
    return str(best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
