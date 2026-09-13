def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));left=[0]*n;right=[0]*n
    for i in range(1,n):left[i]=left[i-1]+1 if a[i-1]>a[i] else 0
    for i in range(n-2,-1,-1):right[i]=right[i+1]+1 if a[i]<=a[i+1] else 0
    return ' '.join(str(i+1) for i in range(n) if left[i]>=k and right[i]>=k)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
