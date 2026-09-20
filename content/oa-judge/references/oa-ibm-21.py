def solve(d):
    a=list(map(int,d[1:]));n=len(a);up=[1]*n;down=[1]*n
    for i in range(1,n):
        if a[i]>=a[i-1]:up[i]=up[i-1]+1
    for i in range(n-2,-1,-1):
        if a[i]>=a[i+1]:down[i]=down[i+1]+1
    return str(max(up[i]+down[i]-1 for i in range(n)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
