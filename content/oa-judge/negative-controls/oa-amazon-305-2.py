def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]))
    if k>n or n>2*k:return '-1'
    pairs=n-k;answer=a[-1]
    for i in range(pairs):answer=max(answer,a[i]+a[2*pairs-1-i])
    return str(a[-1])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
