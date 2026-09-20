def solve(d):
    n,bad=map(int,d)
    if bad==0:return '-1'
    total=n*(n+1)//2;hit=any(j*(j+1)//2==bad for j in range(1,n+1))
    return str(total-int(hit))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
