def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));total=sum(a);window=sum(a[:k]);q=window
    for i in range(k,n):window+=a[i]-a[i-k];q=min(q,window)
    return str(total+q*(q+1)//2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
