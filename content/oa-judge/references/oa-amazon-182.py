def solve(d):
    a=list(map(int,d[1:]));n=len(a)
    while n>2:
        for i in range(n-1):a[i]=(a[i]+a[i+1])%10
        n-=1
    return str(a[0])+str(a[1])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
