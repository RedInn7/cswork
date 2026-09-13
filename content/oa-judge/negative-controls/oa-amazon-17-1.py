def solve(d):
    n,k=map(int,d[:2]); a=sorted(map(int,d[2:])); pairs=n-k; answer=a[-1]
    for i in range(pairs): answer=max(answer,a[i]+a[n-1-i])
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
