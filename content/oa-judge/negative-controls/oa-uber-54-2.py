def solve(d):
    a=list(map(int,d[1:]));n=len(a)
    if all(a[i]<a[i+1] for i in range(n-1)):return '0'
    breaks=[i for i in range(n) if a[i]>a[(i+1)%n]]
    return str(breaks[0]+1) if len(breaks)==1 else '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
