def solve(d):
    total,n=map(int,d[:2]); a=sorted(set(map(int,d[2:]))); gap=0
    for i in range(1,len(a)): gap=max(gap,a[i]-a[i-1])
    return str(total-gap)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
