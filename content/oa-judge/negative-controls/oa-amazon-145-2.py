def solve(d):
    a=list(map(int,d[1:]));length=len(a)
    while length>2:
        for i in range(length-1):a[i]=(a[i]+a[i])%10
        length-=1
    return str(a[0])+str(a[1])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
